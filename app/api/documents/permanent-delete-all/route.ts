import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, isNotNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
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

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all trashed documents with their file paths
    const trashedDocuments = await db
      .select({
        id: documents.id,
        documentFilePath: documents.documentFilePath,
        signedDocumentFilePath: documents.signedDocumentFilePath,
      })
      .from(documents)
      .where(and(eq(documents.ownerId, session.user.id), isNotNull(documents.deletedAt)));

    if (trashedDocuments.length === 0) {
      return NextResponse.json({ message: 'No documents to delete', deletedCount: 0 });
    }

    // Collect all S3 keys to delete
    const keysToDelete: string[] = [];
    for (const doc of trashedDocuments) {
      const docKey = extractS3Key(doc.documentFilePath);
      if (docKey) keysToDelete.push(docKey);
      if (doc.signedDocumentFilePath) {
        const signedKey = extractS3Key(doc.signedDocumentFilePath);
        if (signedKey) keysToDelete.push(signedKey);
      }
    }

    // Delete S3 objects (best-effort, in parallel)
    await Promise.all(keysToDelete.map(deleteS3Object));

    // Permanently delete all trashed documents from DB
    await db.delete(documents).where(and(eq(documents.ownerId, session.user.id), isNotNull(documents.deletedAt)));

    logger.info('Permanently deleted all trashed documents', {
      userId: session.user.id,
      deletedCount: trashedDocuments.length,
      s3ObjectsDeleted: keysToDelete.length,
    });

    return NextResponse.json({
      success: true,
      message: 'All trashed documents permanently deleted',
      deletedCount: trashedDocuments.length,
    });
  } catch (error) {
    logger.error('Error permanently deleting all documents', error);
    return NextResponse.json({ error: 'Failed to delete documents' }, { status: 500 });
  }
}
