import { and, eq, ne } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { users } from '@/database/drizzle/auth-schema';
import {
  documentAuditLog,
  documentNotifications,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { isDocumentExpired } from '@/lib/document-expiration';
import { generateDeclinedEmail, sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { signingTokenMatches } from '@/lib/signing-tokens';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; signatureRequestId?: string };
    if (!body.token || !body.signatureRequestId) {
      return NextResponse.json({ error: 'Token and signature request ID are required' }, { status: 400 });
    }
    const token = body.token;
    const signatureRequestId = body.signatureRequestId;

    const outcome = await db.transaction(async (tx) => {
      const rows = await tx
        .select({ request: signatureRequests, participant: documentParticipants, document: documents })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
        .where(eq(signatureRequests.id, signatureRequestId))
        .for('update');
      const row = rows[0];
      if (!row || !signingTokenMatches(row.request.accessToken, token)) return { kind: 'invalid' as const };
      if (row.request.status === 'SIGNED') return { kind: 'signed' as const };
      if (row.request.status === 'DECLINED') return { kind: 'already-declined' as const };
      if (
        row.document.deletedAt ||
        isDocumentExpired(row.document.expiresAt) ||
        row.document.signingMethod !== 'ELECTRONIC' ||
        !['PENDING', 'IN_PROGRESS'].includes(row.document.status || '') ||
        row.request.status !== 'PENDING'
      )
        return { kind: 'closed' as const };

      await tx
        .update(signatureRequests)
        .set({ status: 'CANCELLED', accessToken: null })
        .where(
          and(
            eq(signatureRequests.documentId, row.document.id),
            ne(signatureRequests.id, row.request.id),
            eq(signatureRequests.status, 'PENDING'),
          ),
        );
      await tx
        .update(signatureRequests)
        .set({ status: 'DECLINED', accessToken: null })
        .where(eq(signatureRequests.id, row.request.id));
      await tx
        .update(documents)
        .set({ status: 'DECLINED', updatedAt: new Date() })
        .where(eq(documents.id, row.document.id));
      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId: row.document.id,
        userId: row.participant.userId,
        action: 'DOCUMENT_DECLINED',
        details: { participantId: row.participant.id, signatureRequestId: row.request.id },
        createdAt: new Date(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
      return { kind: 'declined' as const, ...row };
    });

    if (outcome.kind === 'invalid') return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
    if (outcome.kind === 'signed')
      return NextResponse.json({ error: 'A signed request cannot be declined' }, { status: 409 });
    if (outcome.kind === 'closed')
      return NextResponse.json({ error: 'This document is already closed' }, { status: 409 });
    if (outcome.kind === 'already-declined') return NextResponse.json({ success: true, alreadyDeclined: true });

    const [owner, signer] = await Promise.all([
      db
        .select()
        .from(users)
        .where(eq(users.id, outcome.document.ownerId))
        .then((rows) => rows[0]),
      db
        .select()
        .from(users)
        .where(eq(users.id, outcome.participant.userId))
        .then((rows) => rows[0]),
    ]);
    let notificationDelivered = false;
    if (owner?.email) {
      notificationDelivered = await sendEmail({
        to: owner.email,
        subject: `Signature declined: ${outcome.document.name}`,
        html: generateDeclinedEmail({
          documentName: outcome.document.name,
          recipientName: owner.name || owner.email,
          signerName: signer?.name || signer?.email || 'A signer',
        }),
      });
      await db.insert(documentNotifications).values({
        id: crypto.randomUUID(),
        documentId: outcome.document.id,
        recipientEmail: owner.email,
        notificationType: `DOCUMENT_DECLINED:${outcome.request.id}`,
        sentAt: new Date(),
        isDelivered: notificationDelivered,
        deliveredAt: notificationDelivered ? new Date() : null,
      });
    }

    return NextResponse.json({
      success: true,
      notificationDelivered,
      message: 'Signature declined and workflow stopped',
    });
  } catch (error) {
    logger.error('Error declining signature', error);
    return NextResponse.json({ error: 'Failed to decline signature' }, { status: 500 });
  }
}
