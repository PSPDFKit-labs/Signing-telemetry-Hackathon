import { and, asc, eq, like } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  documentAuditLog,
  documentNotifications,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { type SigningNotificationTarget, sendSigningNotifications } from '@/lib/signing-notifications';
import { createSigningToken } from '@/lib/signing-tokens';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: documentId } = await params;
    const body = (await request.json()) as { expiresAt?: string | null; emailMessage?: string; emailSubject?: string };
    let requestedExpiresAt: Date | null | undefined;
    if (body.expiresAt != null) {
      requestedExpiresAt = new Date(body.expiresAt);
      if (Number.isNaN(requestedExpiresAt.getTime()) || requestedExpiresAt <= new Date()) {
        return NextResponse.json({ error: 'expiresAt must be a valid future date' }, { status: 400 });
      }
    } else if (body.expiresAt === null) {
      requestedExpiresAt = null;
    }

    const ownerId = session.user.id;
    const preparation = await db.transaction(async (tx) => {
      const documentResults = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId)))
        .for('update');
      if (documentResults.length === 0) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

      const document = documentResults[0];
      if (document.deletedAt) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      if (document.signingMethod !== 'ELECTRONIC' || !['PENDING', 'IN_PROGRESS'].includes(document.status ?? '')) {
        return NextResponse.json({ error: 'Document is not available for electronic resend' }, { status: 409 });
      }
      const expiresAt = requestedExpiresAt === undefined ? document.expiresAt : requestedExpiresAt;
      if (expiresAt && expiresAt <= new Date()) {
        return NextResponse.json({ error: 'Set a future expiration date before resending' }, { status: 410 });
      }

      const signerRequests = await tx
        .select({ participant: documentParticipants, signatureRequest: signatureRequests })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .where(eq(signatureRequests.documentId, documentId))
        .orderBy(asc(documentParticipants.signingOrder));
      const pendingSignerRequests = signerRequests.filter(
        ({ participant, signatureRequest }) =>
          participant.accessLevel === 'SIGNER' && signatureRequest.status === 'PENDING',
      );
      if (pendingSignerRequests.length === 0) {
        return NextResponse.json({ error: 'No pending signing recipients found' }, { status: 400 });
      }

      const firstSigningOrder = Math.min(
        ...pendingSignerRequests.map(({ participant }) => participant.signingOrder ?? 0),
      );
      const tokenByRequestId = new Map<string, string>();
      const pendingUpdates = pendingSignerRequests.map(({ participant, signatureRequest }) => {
        const shouldActivate =
          !document.requireSequentialSigning || (participant.signingOrder ?? 0) === firstSigningOrder;
        const token = shouldActivate ? createSigningToken() : null;
        if (token) tokenByRequestId.set(signatureRequest.id, token.rawToken);
        return {
          id: signatureRequest.id,
          participant,
          accessToken: token?.storedToken ?? null,
        };
      });
      const hasRecordedSignature = signerRequests.some(({ signatureRequest }) => signatureRequest.status === 'SIGNED');

      for (const update of pendingUpdates) {
        await tx
          .update(signatureRequests)
          .set({ accessToken: update.accessToken, requestedAt: new Date() })
          .where(and(eq(signatureRequests.id, update.id), eq(signatureRequests.status, 'PENDING')));
      }
      await tx
        .delete(documentNotifications)
        .where(
          and(
            eq(documentNotifications.documentId, documentId),
            like(documentNotifications.notificationType, 'SIGNATURE_REQUEST:%'),
          ),
        );
      await tx
        .update(documents)
        .set({ status: hasRecordedSignature ? 'IN_PROGRESS' : 'PENDING', expiresAt, updatedAt: new Date() })
        .where(eq(documents.id, documentId));
      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId,
        userId: ownerId,
        action: 'DOCUMENT_RESENT',
        details: { pendingSignerCount: pendingSignerRequests.length },
        createdAt: new Date(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      const targets: SigningNotificationTarget[] = pendingUpdates.flatMap((update) => {
        const rawToken = tokenByRequestId.get(update.id);
        if (!rawToken) return [];
        return [
          {
            participantId: update.participant.id,
            signatureRequestId: update.id,
            userId: update.participant.userId,
            rawToken,
          },
        ];
      });
      return { document, expiresAt, targets, signerCount: pendingSignerRequests.length };
    });
    if (preparation instanceof NextResponse) return preparation;
    const { document, expiresAt, targets, signerCount } = preparation;

    const emailsSent = await sendSigningNotifications({
      documentId,
      documentName: document.name,
      expiresAt,
      message: body.emailMessage,
      senderName: session.user.name || 'A user',
      subject: body.emailSubject,
      targets,
    });

    return NextResponse.json({ success: true, documentId, signerCount, emailsSent });
  } catch (error) {
    logger.error('Error resending document:', error);
    return NextResponse.json({ error: 'Failed to resend document' }, { status: 500 });
  }
}
