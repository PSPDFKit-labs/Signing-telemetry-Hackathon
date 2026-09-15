import { and, eq } from 'drizzle-orm';
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
import { generateCancellationEmail, sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify the user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the document ID from the route params
    const { id: documentId } = await params;

    // Get optional cancellation reason from request body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // No body or invalid JSON - that's okay, reason is optional
    }

    const ownerId = session.user.id;
    const cancellation = await db.transaction(async (tx) => {
      // Serialize cancellation with signing and other document transitions.
      const documentResults = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId)))
        .for('update');

      if (documentResults.length === 0) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      const document = documentResults[0];
      if (document.deletedAt) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      if (document.status === 'DECLINED') {
        return NextResponse.json({ error: 'Cannot cancel a declined document' }, { status: 409 });
      }

      // Check if document is already cancelled
      if (document.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Document is already cancelled' }, { status: 400 });
      }

      // Check if document is completed (all signatures done)
      if (document.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Cannot cancel a completed document' }, { status: 400 });
      }

      // Get all pending signature requests for this document
      const pendingRequests = await tx
        .select({
          signatureRequest: signatureRequests,
          participant: documentParticipants,
        })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .where(and(eq(signatureRequests.documentId, documentId), eq(signatureRequests.status, 'PENDING')));

      // Update all PENDING signature requests to CANCELLED
      const cancelledCount = await tx
        .update(signatureRequests)
        .set({ status: 'CANCELLED', accessToken: null })
        .where(and(eq(signatureRequests.documentId, documentId), eq(signatureRequests.status, 'PENDING')))
        .returning();

      // Update document status to CANCELLED
      await tx
        .update(documents)
        .set({
          status: 'CANCELLED',
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      // Create audit log entry
      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId,
        userId: ownerId,
        action: 'DOCUMENT_CANCELLED',
        details: {
          reason,
          cancelledSignatureRequests: cancelledCount.length,
        },
        createdAt: new Date(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
      return { document, pendingRequests, cancelledCount };
    });
    if (cancellation instanceof NextResponse) return cancellation;
    const { document, pendingRequests, cancelledCount } = cancellation;

    // Send cancellation emails to pending recipients
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let emailsSent = 0;

    for (const { participant } of pendingRequests) {
      // Fetch user information for this participant
      const recipientUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, participant.userId),
      });

      if (!recipientUser?.email) {
        logger.warn('Participant user not found or has no email', { participantId: participant.id });
        continue;
      }

      const emailHtml = generateCancellationEmail({
        recipientName: recipientUser.name || recipientUser.email,
        senderName: session.user.name || 'The sender',
        documentName: document.name,
        reason,
        dashboardUrl: `${appUrl}/inbox`,
      });

      const emailSent = await sendEmail({
        to: recipientUser.email,
        subject: `Document Cancelled: ${document.name}`,
        html: emailHtml,
      });

      if (emailSent) {
        emailsSent++;

        // Track notification
        await db.insert(documentNotifications).values({
          id: crypto.randomUUID(),
          documentId,
          recipientEmail: recipientUser.email,
          notificationType: 'DOCUMENT_CANCELLED',
          sentAt: new Date(),
          isDelivered: true,
          deliveredAt: new Date(),
        });
      } else {
        logger.warn('Failed to send cancellation email to participant', { participantId: participant.id });

        // Track failed notification
        await db.insert(documentNotifications).values({
          id: crypto.randomUUID(),
          documentId,
          recipientEmail: recipientUser.email,
          notificationType: 'DOCUMENT_CANCELLED',
          sentAt: new Date(),
          isDelivered: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document cancelled successfully',
      documentId,
      cancelledSignatureRequests: cancelledCount.length,
      emailsSent,
    });
  } catch (error) {
    logger.error('Error cancelling document:', error);
    return NextResponse.json({ error: 'Failed to cancel document' }, { status: 500 });
  }
}
