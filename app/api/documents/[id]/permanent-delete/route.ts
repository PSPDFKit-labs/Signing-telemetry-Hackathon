import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';

/** Extract the S3 key from a full URL or path */
function extractS3Key(filePath: string): string | null {
  if (!filePath) return null;
  try {
    return filePath.startsWith('http') ? new URL(filePath).pathname.substring(1) : filePath;
  } catch {
    return filePath;
  }
}

/** Best-effort delete of an S3 object — failures are logged but don't block */
async function deleteS3Object(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
      }),
    );
  } catch (error) {
    logger.error('Failed to delete S3 object', error, { key });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Fetch file paths before deleting so we can clean up S3
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.ownerId, session.user.id)),
      columns: { documentFilePath: true, signedDocumentFilePath: true },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete S3 objects (best-effort)
    const keysToDelete = [
      extractS3Key(doc.documentFilePath),
      doc.signedDocumentFilePath ? extractS3Key(doc.signedDocumentFilePath) : null,
    ].filter(Boolean) as string[];

    await Promise.all(keysToDelete.map(deleteS3Object));

    // Permanent delete from database
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.ownerId, session.user.id)));

    return NextResponse.json({ success: true, message: 'Document permanently deleted' });
  } catch (error) {
    logger.error('Error permanently deleting document:', error);
    return NextResponse.json({ error: 'Failed to permanently delete document' }, { status: 500 });
  }
}
