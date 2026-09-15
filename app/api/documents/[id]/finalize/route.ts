import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentParticipants, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { finalizeDocument } from '@/lib/digital-signing';
import { sendCompletionEmails } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { id: documentId } = await params;
    const document = await db.query.documents.findFirst({
      where: (documents, { and, eq }) => and(eq(documents.id, documentId), eq(documents.ownerId, userId)),
    });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (document.status === 'COMPLETED') return NextResponse.json({ success: true, alreadyFinalized: true });
    if (document.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Document is not ready for finalization' }, { status: 409 });
    }

    const unsignedRequired = await db
      .select({ id: signatureRequests.id })
      .from(signatureRequests)
      .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
      .where(
        and(
          eq(signatureRequests.documentId, documentId),
          or(eq(documentParticipants.isRequired, true), isNull(documentParticipants.isRequired)),
          ne(signatureRequests.status, 'SIGNED'),
        ),
      )
      .limit(1);
    if (unsignedRequired.length > 0) {
      return NextResponse.json({ error: 'Required signatures are still outstanding' }, { status: 409 });
    }

    const annotation = await db.query.documentAnnotations.findFirst({
      where: (annotations, { eq }) => eq(annotations.documentId, documentId),
    });
    if (!annotation?.annotationData || typeof annotation.annotationData !== 'object') {
      return NextResponse.json({ error: 'Document annotations are missing' }, { status: 409 });
    }

    const signedPdf = await finalizeDocument(annotation.annotationData as Record<string, unknown>, documentId);
    if (!signedPdf) {
      return NextResponse.json({ error: 'Document finalization failed; it is safe to retry' }, { status: 502 });
    }
    await sendCompletionEmails(signedPdf, documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error retrying document finalization', error);
    return NextResponse.json({ error: 'Failed to finalize document' }, { status: 500 });
  }
}
