import { createHash } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentAnnotations, documentAuditLog, documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { sendCompletionEmails } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';
import { validateUploadContent } from '@/lib/upload-validation';
import { canAcceptWetSignedReturn, validateWetSignedPdf } from '@/lib/wet-signing';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_RETURN_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = session.user.id;
    const { id: documentId } = await params;
    const document = await db.query.documents.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, documentId), eq(table.ownerId, ownerId)),
    });
    if (!document || document.deletedAt) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (!canAcceptWetSignedReturn(document.status, document.signingMethod)) {
      return NextResponse.json({ error: 'Document is not awaiting a wet-signed return' }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A returned PDF is required' }, { status: 400 });
    if (file.size === 0 || file.size > MAX_RETURN_SIZE) {
      return NextResponse.json({ error: 'Returned PDF must be between 1 byte and 100MB' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentError = validateUploadContent(file.name, 'application/pdf', buffer);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
    const pdfError = await validateWetSignedPdf(buffer);
    if (pdfError) return NextResponse.json({ error: pdfError }, { status: 400 });

    const hash = createHash('sha256').update(buffer).digest('hex');
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) return NextResponse.json({ error: 'Storage is not configured' }, { status: 503 });
    const key = `wet-signed/${documentId}/${hash}.pdf`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        Metadata: { returnedBy: ownerId, originalFilename: encodeURIComponent(file.name) },
      }),
    );
    const signedDocumentFilePath = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    const returnedAt = new Date();

    const completed = await db.transaction(async (tx) => {
      const updated = await tx
        .update(documents)
        .set({
          status: 'COMPLETED',
          signedDocumentFilePath,
          wetSignedReturnedAt: returnedAt,
          updatedAt: returnedAt,
        })
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.status, 'AWAITING_WET_SIGNATURE'),
            eq(documents.signingMethod, 'WET'),
            isNull(documents.deletedAt),
          ),
        )
        .returning();
      if (updated.length === 0) return false;
      await tx
        .update(documentAnnotations)
        .set({ isFinalized: true })
        .where(eq(documentAnnotations.documentId, documentId));
      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId,
        userId: ownerId,
        action: 'WET_SIGNATURE_RETURNED',
        details: { signedDocumentFilePath, hash, originalFilename: file.name },
        createdAt: returnedAt,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
      return true;
    });
    if (!completed) return NextResponse.json({ error: 'Wet-sign return was already reconciled' }, { status: 409 });

    const completedPdf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    await sendCompletionEmails(completedPdf, documentId);
    return NextResponse.json({ success: true, status: 'COMPLETED', returnedAt: returnedAt.toISOString() });
  } catch (error) {
    logger.error('Could not reconcile wet-signed return', error);
    return NextResponse.json({ error: 'Failed to upload returned wet-signed PDF' }, { status: 500 });
  }
}
