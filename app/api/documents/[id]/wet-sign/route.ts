import { GetObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentAuditLog, documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';
import { storageKeyFromPath } from '@/lib/storage-path';
import { canStartWetSign } from '@/lib/wet-signing';

export const runtime = 'nodejs';

async function ownedDocument(documentId: string, ownerId: string) {
  return db.query.documents.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, documentId), eq(table.ownerId, ownerId)),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = session.user.id;
    const { id: documentId } = await params;
    const document = await ownedDocument(documentId, ownerId);
    if (!document || document.deletedAt) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (!canStartWetSign(document.status)) {
      return NextResponse.json({ error: 'Document cannot enter the wet-sign workflow' }, { status: 409 });
    }

    if (document.status === 'DRAFT') {
      const started = await db.transaction(async (tx) => {
        const updated = await tx
          .update(documents)
          .set({ signingMethod: 'WET', status: 'AWAITING_WET_SIGNATURE', updatedAt: new Date() })
          .where(and(eq(documents.id, documentId), eq(documents.status, 'DRAFT'), isNull(documents.deletedAt)))
          .returning();
        if (updated.length === 0) return false;
        await tx.insert(documentAuditLog).values({
          id: crypto.randomUUID(),
          documentId,
          userId: ownerId,
          action: 'WET_SIGNATURE_EXPORTED',
          details: { filePath: document.documentFilePath },
          createdAt: new Date(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        });
        return true;
      });
      if (!started) return NextResponse.json({ error: 'Document changed; reload before exporting' }, { status: 409 });
    }
    return NextResponse.json({ success: true, downloadUrl: `/api/documents/${documentId}/wet-sign` });
  } catch (error) {
    logger.error('Could not start wet-sign workflow', error);
    return NextResponse.json({ error: 'Failed to prepare wet-sign export' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
    const ownerId = session.user.id;
    const { id: documentId } = await params;
    const document = await ownedDocument(documentId, ownerId);
    if (!document || document.deletedAt) return new Response('Document not found', { status: 404 });
    if (document.signingMethod !== 'WET' || !['AWAITING_WET_SIGNATURE', 'COMPLETED'].includes(document.status || '')) {
      return new Response('Document is not in the wet-sign workflow', { status: 409 });
    }
    const key = storageKeyFromPath(document.documentFilePath);
    if (!key) return new Response('Document path is invalid', { status: 500 });
    const object = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }));
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) return new Response('Document could not be read', { status: 502 });
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.name.replace(/["\r\n]/g, '')}-wet-sign.pdf"`,
        'Content-Length': String(bytes.byteLength),
      },
    });
  } catch (error) {
    logger.error('Could not download wet-sign packet', error);
    return new Response('Failed to download wet-sign packet', { status: 500 });
  }
}
