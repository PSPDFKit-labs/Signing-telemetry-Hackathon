import { and, asc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  documentAuditLog,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { parseFinalizationMode } from '@/lib/finalization-policy';
import { logger } from '@/lib/logger';
import { type SigningNotificationTarget, sendSigningNotifications } from '@/lib/signing-notifications';
import { createSigningToken } from '@/lib/signing-tokens';

function sendGuard(document: typeof documents.$inferSelect) {
  if (document.deletedAt) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (document.expiresAt && document.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Document has expired' }, { status: 410 });
  }
  if (document.signingMethod !== 'ELECTRONIC' ||
      !['DRAFT', 'PENDING', 'IN_PROGRESS'].includes(document.status ?? '')) {
    return NextResponse.json({ error: 'Document is not available for electronic sending' }, { status: 409 });
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = session.user.id;
    const { id: documentId } = await params;
    const body = (await request.json()) as {
      emailSubject?: string;
      emailMessage?: string;
      finalizationMode?: unknown;
      signingMethod?: unknown;
    };
    const finalizationMode = parseFinalizationMode(body.finalizationMode);
    if (body.signingMethod === 'WET') {
      return NextResponse.json({ error: 'Use the wet-sign export workflow for offline signatures' }, { status: 409 });
    }
    const documentResults = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.ownerId, session.user.id)));
    if (documentResults.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documentResults[0];
    const denied = sendGuard(document);
    if (denied) return denied;

    const participants = await db
      .select()
      .from(documentParticipants)
      .where(eq(documentParticipants.documentId, documentId))
      .orderBy(asc(documentParticipants.signingOrder));
    const signers = participants.filter((participant) => participant.accessLevel === 'SIGNER');
    if (signers.length === 0) {
      return NextResponse.json({ error: 'No signing recipients found for this document' }, { status: 400 });
    }

    const firstSigningOrder = Math.min(...signers.map((signer) => signer.signingOrder ?? 0));
    const tokenByRequestId = new Map<string, string>();
    const requestValues = signers.map((signer) => {
      const requestId = crypto.randomUUID();
      const shouldActivate = !document.requireSequentialSigning || (signer.signingOrder ?? 0) === firstSigningOrder;
      const token = shouldActivate ? createSigningToken() : null;
      if (token) tokenByRequestId.set(requestId, token.rawToken);

      return {
        id: requestId,
        documentId,
        participantId: signer.id,
        status: 'PENDING' as const,
        signatureType: 'ELECTRONIC' as const,
        accessToken: token?.storedToken ?? null,
        requestedAt: new Date(),
      };
    });

    const insertedRequests = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId)))
        .for('update');
      if (!current) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      const denied = sendGuard(current);
      if (denied) return denied;
      const inserted = await tx
        .insert(signatureRequests)
        .values(requestValues)
        .onConflictDoNothing({ target: [signatureRequests.documentId, signatureRequests.participantId] })
        .returning();

      if (inserted.length > 0) {
        await tx
          .update(documents)
          .set({ status: 'PENDING', finalizationMode, updatedAt: new Date() })
          .where(eq(documents.id, documentId));
      }
      return inserted;
    });

    if (insertedRequests instanceof NextResponse) return insertedRequests;
    if (insertedRequests.length === 0) {
      return NextResponse.json({
        success: true,
        alreadySent: true,
        message: 'Document was already sent',
        documentId,
        recipientCount: signers.length,
        emailsSent: 0,
      });
    }

    await db.insert(documentAuditLog).values({
      id: crypto.randomUUID(),
      documentId,
      userId: session.user.id,
      action: 'DOCUMENT_SENT',
      details: {
        recipientCount: participants.length,
        signerCount: signers.length,
        emailSubject: body.emailSubject,
        finalizationMode,
      },
      createdAt: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const signerById = new Map(signers.map((signer) => [signer.id, signer]));
    const targets: SigningNotificationTarget[] = insertedRequests.flatMap((signatureRequest) => {
      const signer = signerById.get(signatureRequest.participantId);
      const rawToken = tokenByRequestId.get(signatureRequest.id);
      if (!signer || !rawToken) return [];
      return [{ participantId: signer.id, signatureRequestId: signatureRequest.id, userId: signer.userId, rawToken }];
    });

    const emailsSent = await sendSigningNotifications({
      documentId,
      documentName: document.name,
      expiresAt: document.expiresAt,
      message: body.emailMessage,
      senderName: session.user.name || 'A user',
      subject: body.emailSubject,
      targets,
    });

    return NextResponse.json({
      success: true,
      message: 'Document sent successfully',
      documentId,
      recipientCount: signers.length,
      emailsSent,
      emailsExpected: targets.length,
    });
  } catch (error) {
    logger.error('Error sending document:', error);
    return NextResponse.json({ error: 'Failed to send document' }, { status: 500 });
  }
}
