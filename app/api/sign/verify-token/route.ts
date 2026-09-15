import { and, desc, eq, lt, or } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { users } from '@/database/drizzle/auth-schema';
import {
  documentAnnotations,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { isDocumentExpired } from '@/lib/document-expiration';
import { logger } from '@/lib/logger';
import { tokenLookupCandidates } from '@/lib/signing-tokens';

/**
 * Verify access token and return document signing data
 * This is called by the /sign/[token] page to authenticate recipients
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find signature request by hashed token. The legacy candidate keeps links
    // issued before this migration usable until their next rotation.
    const [hashedToken, legacyToken] = tokenLookupCandidates(token);
    const signatureRequestResults = await db
      .select({
        signatureRequest: signatureRequests,
        participant: documentParticipants,
        document: documents,
      })
      .from(signatureRequests)
      .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
      .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
      .where(or(eq(signatureRequests.accessToken, hashedToken), eq(signatureRequests.accessToken, legacyToken)));

    if (signatureRequestResults.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const signatureRequest = signatureRequestResults[0];

    // Check if document has expired (expires at end of day, not start)
    if (isDocumentExpired(signatureRequest.document.expiresAt)) {
      return NextResponse.json({ error: 'This document has expired' }, { status: 410 });
    }

    // Check if document has been deleted
    if (signatureRequest.document.deletedAt) {
      return NextResponse.json({ error: 'This document has been deleted' }, { status: 410 });
    }

    // Check if signature request has been cancelled
    if (signatureRequest.signatureRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This document has been cancelled by the sender' }, { status: 410 });
    }

    // Check if document has been cancelled
    if (signatureRequest.document.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This document has been cancelled by the sender' }, { status: 410 });
    }

    // Check if it's the user's turn to sign (for sequential signing)
    const userSigningOrder = signatureRequest.participant.signingOrder;
    if (signatureRequest.document.requireSequentialSigning && userSigningOrder !== null && userSigningOrder > 0) {
      // Check if there are pending signatures from participants with lower signing order
      const pendingPreviousSigners = await db
        .select({ id: signatureRequests.id })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .where(
          and(
            eq(documentParticipants.documentId, signatureRequest.document.id),
            lt(documentParticipants.signingOrder, userSigningOrder),
            eq(signatureRequests.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (pendingPreviousSigners.length > 0) {
        return NextResponse.json(
          { error: 'It is not yet your turn to sign. Please wait for previous signers to complete.' },
          { status: 403 },
        );
      }
    }

    // Get recipient user information
    const recipientUserResults = await db
      .select()
      .from(users)
      .where(eq(users.id, signatureRequest.participant.userId))
      .limit(1);

    if (recipientUserResults.length === 0) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const recipientUser = recipientUserResults[0];
    const [sender] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, signatureRequest.document.ownerId))
      .limit(1);

    // Get document annotations (field placements) - use latest annotation record
    const annotations = await db
      .select()
      .from(documentAnnotations)
      .where(eq(documentAnnotations.documentId, signatureRequest.document.id))
      .orderBy(desc(documentAnnotations.createdAt));

    // Get all participants for this document
    const allParticipants = await db
      .select({
        participant: documentParticipants,
        user: users,
      })
      .from(documentParticipants)
      .innerJoin(users, eq(documentParticipants.userId, users.id))
      .where(eq(documentParticipants.documentId, signatureRequest.document.id));

    // Log access attempt
    logger.info('Document access via signing token', {
      documentId: signatureRequest.document.id,
      participantId: signatureRequest.participant.id,
      recipientEmail: recipientUser.email,
    });

    return NextResponse.json({
      success: true,
      sender: { name: sender?.name || 'Document sender' },
      finalizationAvailable: Boolean(process.env.NUTRIENT_API_KEY?.trim()),
      document: {
        id: signatureRequest.document.id,
        name: signatureRequest.document.name,
        filePath: signatureRequest.document.documentFilePath,
        expiresAt: signatureRequest.document.expiresAt,
      },
      recipient: {
        id: signatureRequest.participant.id,
        name: recipientUser.name || recipientUser.email,
        email: recipientUser.email,
        accessLevel: signatureRequest.participant.accessLevel,
        signingOrder: signatureRequest.participant.signingOrder,
      },
      signatureRequest: {
        id: signatureRequest.signatureRequest.id,
        status: signatureRequest.signatureRequest.status,
        requestedAt: signatureRequest.signatureRequest.requestedAt,
      },
      annotations: annotations.length > 0 ? annotations[0].annotationData : { fields: [] },
      participants: allParticipants.map((p) => ({
        id: p.participant.id,
        participantId: p.participant.id,
        name: p.user.name || p.user.email,
        email: p.user.email,
        role: p.participant.accessLevel,
      })),
    });
  } catch (error) {
    logger.error('Error verifying signing token', error);
    return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 });
  }
}
