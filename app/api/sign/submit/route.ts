import { and, eq, lt } from 'drizzle-orm';
import { after, type NextRequest, NextResponse } from 'next/server';
import {
  documentAnnotations,
  documentAuditLog,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { finalizeDocument } from '@/lib/digital-signing';
import { isDocumentExpired } from '@/lib/document-expiration';
import { sendCompletionEmails } from '@/lib/email-service';
import { InvalidSigningPayloadError, mergeSignerInstantJson } from '@/lib/instant-json-security';
import { logger } from '@/lib/logger';
import { notifyNextSequentialSigners } from '@/lib/signing-notifications';
import { allRequiredSignaturesRecorded, isSigningOrderComplete } from '@/lib/signing-progress';
import { signingTokenMatches } from '@/lib/signing-tokens';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; signatureRequestId?: string; instantJSON?: unknown };
    if (!body.token || !body.signatureRequestId || !body.instantJSON) {
      return NextResponse.json({ error: 'Token, signature request ID, and InstantJSON are required' }, { status: 400 });
    }
    const token = body.token;
    const signatureRequestId = body.signatureRequestId;

    const result = await db.transaction(async (tx) => {
      const requestRows = await tx
        .select({ signatureRequest: signatureRequests, participant: documentParticipants, document: documents })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
        .where(eq(signatureRequests.id, signatureRequestId))
        .for('update');
      const row = requestRows[0];
      if (!row || !signingTokenMatches(row.signatureRequest.accessToken, token)) {
        return { kind: 'invalid' as const };
      }
      if (row.signatureRequest.status === 'SIGNED') {
        return { kind: 'already-signed' as const, documentId: row.document.id };
      }
      if (
        row.signatureRequest.status !== 'PENDING' ||
        row.participant.accessLevel !== 'SIGNER' ||
        row.document.deletedAt ||
        row.document.signingMethod !== 'ELECTRONIC' ||
        !['PENDING', 'IN_PROGRESS'].includes(row.document.status || '')
      ) {
        return { kind: 'closed' as const };
      }
      if (isDocumentExpired(row.document.expiresAt)) {
        return { kind: 'expired' as const };
      }

      // Serializing on the document prevents two parallel signers from
      // finalizing from stale snapshots or losing each other's annotations.
      await tx.select({ id: documents.id }).from(documents).where(eq(documents.id, row.document.id)).for('update');

      if (row.document.requireSequentialSigning && (row.participant.signingOrder ?? 0) > 0) {
        const previousPending = await tx
          .select({ id: signatureRequests.id })
          .from(signatureRequests)
          .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
          .where(
            and(
              eq(signatureRequests.documentId, row.document.id),
              eq(signatureRequests.status, 'PENDING'),
              lt(documentParticipants.signingOrder, row.participant.signingOrder ?? 0),
            ),
          )
          .limit(1);
        if (previousPending.length > 0) return { kind: 'out-of-order' as const };
      }

      const annotationRows = await tx
        .select()
        .from(documentAnnotations)
        .where(eq(documentAnnotations.documentId, row.document.id))
        .for('update');
      const annotationRecord = annotationRows[0];
      if (!annotationRecord) throw new InvalidSigningPayloadError('Document field definitions are missing');

      const mergedInstantJSON = mergeSignerInstantJson(
        annotationRecord.annotationData,
        body.instantJSON,
        row.participant.id,
      );
      await tx
        .update(documentAnnotations)
        .set({ annotationData: mergedInstantJSON, isFinalized: false })
        .where(eq(documentAnnotations.id, annotationRecord.id));
      await tx
        .update(signatureRequests)
        .set({ status: 'SIGNED', signedAt: new Date(), accessToken: null })
        .where(and(eq(signatureRequests.id, row.signatureRequest.id), eq(signatureRequests.status, 'PENDING')));

      const allRequests = await tx
        .select({ request: signatureRequests, participant: documentParticipants })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .where(eq(signatureRequests.documentId, row.document.id));
      const allRequiredSigned = allRequiredSignaturesRecorded(allRequests);
      const currentOrder = row.participant.signingOrder ?? 0;
      const currentOrderComplete = isSigningOrderComplete(allRequests, currentOrder);

      if (allRequiredSigned) {
        await tx
          .update(signatureRequests)
          .set({ status: 'CANCELLED', accessToken: null })
          .where(and(eq(signatureRequests.documentId, row.document.id), eq(signatureRequests.status, 'PENDING')));
      }
      await tx
        .update(documents)
        .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
        .where(eq(documents.id, row.document.id));
      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId: row.document.id,
        userId: row.participant.userId,
        action: 'DOCUMENT_SIGNED',
        details: { participantId: row.participant.id, allRequiredSigned },
        createdAt: new Date(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return {
        kind: 'signed' as const,
        allSigned: allRequiredSigned,
        currentOrder,
        currentOrderComplete,
        documentId: row.document.id,
        mergedInstantJSON,
      };
    });

    if (result.kind === 'invalid') return NextResponse.json({ error: 'Invalid signing link' }, { status: 403 });
    if (result.kind === 'closed')
      return NextResponse.json({ error: 'This signing request is closed' }, { status: 409 });
    if (result.kind === 'expired')
      return NextResponse.json({ error: 'This signing request has expired' }, { status: 410 });
    if (result.kind === 'out-of-order')
      return NextResponse.json({ error: 'It is not yet your turn to sign' }, { status: 409 });
    if (result.kind === 'already-signed') {
      return NextResponse.json({ success: true, alreadySigned: true, documentId: result.documentId });
    }

    let finalized = false;
    if (result.allSigned) {
      const signedPdf = await finalizeDocument(result.mergedInstantJSON, result.documentId);
      if (signedPdf) {
        await sendCompletionEmails(signedPdf, result.documentId);
        finalized = true;
      }
    } else if (result.currentOrderComplete) {
      after(() => notifyNextSequentialSigners(result.documentId, result.currentOrder));
    }

    return NextResponse.json(
      {
        success: true,
        message: finalized
          ? 'Document signed and finalized successfully'
          : result.allSigned
            ? 'Signature recorded, but finalization must be retried by the document owner'
            : 'Document signature recorded successfully',
        allSigned: result.allSigned,
        finalizationPending: result.allSigned && !finalized,
        documentId: result.documentId,
      },
      { status: result.allSigned && !finalized ? 202 : 200 },
    );
  } catch (error) {
    if (error instanceof InvalidSigningPayloadError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error('Error submitting signature', error);
    return NextResponse.json({ error: 'Failed to submit signature' }, { status: 500 });
  }
}
