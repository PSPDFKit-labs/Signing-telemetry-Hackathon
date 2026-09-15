import { and, eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { users } from '@/database/drizzle/auth-schema';
import {
  documentAnnotations,
  documentAuditLog,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { isDocumentExpired } from '@/lib/document-expiration';
import { parseFinalizationMode } from '@/lib/finalization-policy';
import { logger } from '@/lib/logger';
import { MAX_REPAPERING_RECIPIENTS, retargetInstantJsonRecipient } from '@/lib/repapering';
import { sendSigningNotifications } from '@/lib/signing-notifications';
import { createSigningToken } from '@/lib/signing-tokens';

interface RepaperingInput {
  batchId?: string;
  recipients?: Array<{ name?: string; email?: string }>;
  emailSubject?: string;
  emailMessage?: string;
  finalizationMode?: unknown;
  signingMethod?: unknown;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = session.user.id;
    const { id: sourceDocumentId } = await params;
    const body = (await request.json()) as RepaperingInput;
    const batchId = body.batchId?.trim();
    const finalizationMode = parseFinalizationMode(body.finalizationMode);
    if (body.signingMethod === 'WET') {
      return NextResponse.json(
        { error: 'Wet-sign repapering must be run as separate offline packets' },
        { status: 409 },
      );
    }
    const recipients = (body.recipients ?? []).map((recipient) => ({
      name: recipient.name?.trim() ?? '',
      email: recipient.email?.trim().toLowerCase() ?? '',
    }));

    if (!batchId || !/^[a-zA-Z0-9-]{16,80}$/.test(batchId)) {
      return NextResponse.json({ error: 'A valid batch id is required' }, { status: 400 });
    }
    if (recipients.length === 0 || recipients.length > MAX_REPAPERING_RECIPIENTS) {
      return NextResponse.json(
        { error: `Choose between 1 and ${MAX_REPAPERING_RECIPIENTS} recipients` },
        { status: 400 },
      );
    }
    const seen = new Set<string>();
    for (const recipient of recipients) {
      if (!recipient.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email) || seen.has(recipient.email)) {
        return NextResponse.json({ error: 'Recipients must have unique valid names and emails' }, { status: 400 });
      }
      seen.add(recipient.email);
    }

    const sourceDocument = await db.query.documents.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, sourceDocumentId), eq(table.ownerId, ownerId)),
    });
    if (!sourceDocument || sourceDocument.deletedAt)
      return NextResponse.json({ error: 'Source document not found' }, { status: 404 });
    if (isDocumentExpired(sourceDocument.expiresAt))
      return NextResponse.json({ error: 'Update the draft expiration before repapering' }, { status: 409 });
    if (sourceDocument.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only a draft can be used for repapering' }, { status: 409 });
    }

    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.ownerId, ownerId), eq(documents.repaperingBatchId, batchId)));
    if (existing.length > 0) {
      return NextResponse.json({ success: true, alreadyCreated: true, created: existing.length });
    }

    const sourceSigners = await db
      .select()
      .from(documentParticipants)
      .where(
        and(eq(documentParticipants.documentId, sourceDocumentId), eq(documentParticipants.accessLevel, 'SIGNER')),
      );
    if (sourceSigners.length !== 1) {
      return NextResponse.json(
        { error: 'Repapering requires exactly one template signer in the source draft' },
        { status: 409 },
      );
    }
    const sourceAnnotation = await db.query.documentAnnotations.findFirst({
      where: (annotation, { eq }) => eq(annotation.documentId, sourceDocumentId),
    });
    if (!sourceAnnotation) {
      return NextResponse.json({ error: 'Place and save the template fields before repapering' }, { status: 409 });
    }

    const created = await db.transaction(async (tx) => {
      // Serialize retries of the same batch. The unique item index remains a
      // second guard, but a concurrent retry should return existing work, not 500.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${batchId}))`);
      const existingBatch = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.ownerId, ownerId), eq(documents.repaperingBatchId, batchId)));
      if (existingBatch.length) return { alreadyCreated: true as const, count: existingBatch.length, items: [] };
      const results: Array<{
        documentId: string;
        documentName: string;
        participantId: string;
        signatureRequestId: string;
        userId: string;
        rawToken: string;
      }> = [];

      for (const [index, recipient] of recipients.entries()) {
        let recipientUser = await tx.query.users.findFirst({
          where: (table, { eq }) => eq(table.email, recipient.email),
        });
        if (!recipientUser) {
          const inserted = await tx
            .insert(users)
            .values({ id: crypto.randomUUID(), name: recipient.name, email: recipient.email, emailVerified: null })
            .onConflictDoNothing({ target: users.email })
            .returning();
          recipientUser =
            inserted[0] ??
            (await tx.query.users.findFirst({ where: (table, { eq }) => eq(table.email, recipient.email) }));
        }
        if (!recipientUser) throw new Error(`Could not resolve ${recipient.email}`);

        const documentId = crypto.randomUUID();
        const participantId = crypto.randomUUID();
        const signatureRequestId = crypto.randomUUID();
        const token = createSigningToken();
        const documentName = `${sourceDocument.name} — ${recipient.name}`;

        await tx.insert(documents).values({
          id: documentId,
          name: documentName,
          templateId: sourceDocument.templateId,
          ownerId,
          documentFilePath: sourceDocument.documentFilePath,
          documentFileHash: sourceDocument.documentFileHash,
          packetManifest: sourceDocument.packetManifest,
          repaperingBatchId: batchId,
          repaperingIndex: index + 1,
          size: sourceDocument.size,
          expiresAt: sourceDocument.expiresAt,
          status: 'PENDING',
          requireSequentialSigning: false,
          finalizationMode,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await tx.insert(documentParticipants).values({
          id: participantId,
          documentId,
          userId: recipientUser.id,
          accessLevel: 'SIGNER',
          signingOrder: 0,
          isRequired: true,
        });
        await tx.insert(documentAnnotations).values({
          id: crypto.randomUUID(),
          documentId,
          creatorId: ownerId,
          annotationData: retargetInstantJsonRecipient(sourceAnnotation.annotationData, sourceSigners[0].id, {
            participantId,
            ...recipient,
          }),
          isFinalized: false,
          createdAt: new Date(),
        });
        await tx.insert(signatureRequests).values({
          id: signatureRequestId,
          documentId,
          participantId,
          signatureType: 'ELECTRONIC',
          status: 'PENDING',
          accessToken: token.storedToken,
          requestedAt: new Date(),
        });
        await tx.insert(documentAuditLog).values({
          id: crypto.randomUUID(),
          documentId,
          userId: ownerId,
          action: 'DOCUMENT_SENT',
          details: { repaperingBatchId: batchId, sourceDocumentId, recipientEmail: recipient.email, finalizationMode },
          createdAt: new Date(),
        });
        results.push({
          documentId,
          documentName,
          participantId,
          signatureRequestId,
          userId: recipientUser.id,
          rawToken: token.rawToken,
        });
      }

      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId: sourceDocumentId,
        userId: ownerId,
        action: 'REPAPERING_BATCH_CREATED',
        details: { batchId, envelopeCount: recipients.length, documentIds: results.map((result) => result.documentId) },
        createdAt: new Date(),
      });
      return { alreadyCreated: false as const, count: results.length, items: results };
    });

    if (created.alreadyCreated)
      return NextResponse.json({ success: true, alreadyCreated: true, created: created.count });

    let emailsSent = 0;
    for (const item of created.items) {
      emailsSent += await sendSigningNotifications({
        documentId: item.documentId,
        documentName: item.documentName,
        expiresAt: sourceDocument.expiresAt,
        message: body.emailMessage,
        senderName: session.user.name || 'A user',
        subject: body.emailSubject,
        targets: [
          {
            participantId: item.participantId,
            signatureRequestId: item.signatureRequestId,
            userId: item.userId,
            rawToken: item.rawToken,
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      batchId,
      created: created.count,
      emailsSent,
      emailsExpected: created.count,
    });
  } catch (error) {
    logger.error('Repapering batch failed', error);
    return NextResponse.json({ error: 'Failed to create repapering batch' }, { status: 500 });
  }
}
