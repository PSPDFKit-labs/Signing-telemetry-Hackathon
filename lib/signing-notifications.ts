import { and, asc, eq, gt } from 'drizzle-orm';
import { users } from '@/database/drizzle/auth-schema';
import {
  documentNotifications,
  documentParticipants,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { generateSigningEmail, sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { createSigningToken } from '@/lib/signing-tokens';

export interface SigningNotificationTarget {
  participantId: string;
  signatureRequestId: string;
  userId: string;
  rawToken: string;
}

interface SendSigningNotificationsOptions {
  documentId: string;
  documentName: string;
  expiresAt?: Date | null;
  message?: string;
  senderName: string;
  subject?: string;
  targets: SigningNotificationTarget[];
}

export async function sendSigningNotifications({
  documentId,
  documentName,
  expiresAt,
  message,
  senderName,
  subject,
  targets,
}: SendSigningNotificationsOptions): Promise<number> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let emailsSent = 0;

  for (const target of targets) {
    const notificationType = `SIGNATURE_REQUEST:${target.signatureRequestId}`;
    const existingNotification = await db.query.documentNotifications.findFirst({
      where: (notification, { and, eq }) =>
        and(eq(notification.documentId, documentId), eq(notification.notificationType, notificationType)),
    });
    if (existingNotification?.isDelivered) continue;

    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, target.userId),
    });
    if (!user?.email) {
      logger.warn('Signing notification recipient has no email address', { participantId: target.participantId });
      continue;
    }

    const signingUrl = `${appUrl}/sign/${target.rawToken}`;
    const success = await sendEmail({
      to: user.email,
      subject: subject || 'Please sign this document',
      html: generateSigningEmail({
        recipientName: user.name || user.email,
        senderName,
        documentName,
        signingUrl,
        message,
        expiresAt: expiresAt || undefined,
      }),
    });

    if (existingNotification) {
      await db
        .update(documentNotifications)
        .set({ sentAt: new Date(), isDelivered: success, deliveredAt: success ? new Date() : null })
        .where(eq(documentNotifications.id, existingNotification.id));
    } else {
      await db.insert(documentNotifications).values({
        id: crypto.randomUUID(),
        documentId,
        recipientEmail: user.email,
        notificationType,
        sentAt: new Date(),
        isDelivered: success,
        deliveredAt: success ? new Date() : null,
      });
    }

    if (success) emailsSent++;
  }

  return emailsSent;
}

/**
 * Activates and notifies the next signing-order group. Later sequential
 * requests intentionally have no token until their turn, so links cannot be
 * used early and raw tokens never need to be stored in the database.
 */
export async function notifyNextSequentialSigners(documentId: string, completedSigningOrder: number): Promise<number> {
  const document = await db.query.documents.findFirst({
    where: (documents, { eq }) => eq(documents.id, documentId),
  });
  if (!document?.requireSequentialSigning || document.status === 'CANCELLED' || document.status === 'DECLINED') {
    return 0;
  }

  const pending = await db
    .select({ request: signatureRequests, participant: documentParticipants })
    .from(signatureRequests)
    .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
    .where(
      and(
        eq(signatureRequests.documentId, documentId),
        eq(signatureRequests.status, 'PENDING'),
        gt(documentParticipants.signingOrder, completedSigningOrder),
      ),
    )
    .orderBy(asc(documentParticipants.signingOrder));

  if (pending.length === 0) return 0;
  const owner = await db.query.users.findFirst({ where: eq(users.id, document.ownerId) });
  const nextOrder = pending[0].participant.signingOrder ?? 0;
  const nextGroup = pending.filter(({ participant }) => (participant.signingOrder ?? 0) === nextOrder);
  const targets: SigningNotificationTarget[] = [];

  for (const { request, participant } of nextGroup) {
    const activated = await db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(signatureRequests)
        .where(eq(signatureRequests.id, request.id))
        .for('update');
      const current = locked[0];
      if (current?.status !== 'PENDING' || current.accessToken) return null;

      const token = createSigningToken();
      await tx
        .update(signatureRequests)
        .set({ accessToken: token.storedToken })
        .where(eq(signatureRequests.id, request.id));
      return token.rawToken;
    });

    if (activated) {
      targets.push({
        participantId: participant.id,
        signatureRequestId: request.id,
        userId: participant.userId,
        rawToken: activated,
      });
    }
  }

  return sendSigningNotifications({
    documentId,
    documentName: document.name,
    expiresAt: document.expiresAt,
    senderName: owner?.name || owner?.email || 'The sender',
    targets,
  });
}
