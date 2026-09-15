import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth-js';
import { MAX_PACKET_DOCUMENTS, mergePdfPacket } from '@/lib/document-packets';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';
import { isUserUploadPath, storageKeyFromPath } from '@/lib/storage-path';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface PacketFileInput {
  url?: string;
  name?: string;
  size?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = (await request.json()) as { title?: string; files?: PacketFileInput[] };
    const files = body.files ?? [];
    if (files.length === 0 || files.length > MAX_PACKET_DOCUMENTS) {
      return NextResponse.json(
        { error: `Choose between 1 and ${MAX_PACKET_DOCUMENTS} PDF documents` },
        { status: 400 },
      );
    }

    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) return NextResponse.json({ error: 'Storage is not configured' }, { status: 503 });

    const sources = await Promise.all(
      files.map(async (file, index) => {
        if (!file.url || !isUserUploadPath(file.url, userId)) {
          throw new Error(`Document ${index + 1} is not an upload owned by this user`);
        }
        const key = storageKeyFromPath(file.url);
        if (!key) throw new Error(`Document ${index + 1} has an invalid storage path`);
        const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await response.Body?.transformToByteArray();
        if (!bytes) throw new Error(`Document ${index + 1} could not be read from storage`);
        return {
          name: file.name?.trim() || `Document ${index + 1}.pdf`,
          size: bytes.byteLength,
          bytes,
        };
      }),
    );

    const packet = await mergePdfPacket(sources);
    const key = `uploads/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.pdf`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: packet.bytes,
        ContentType: 'application/pdf',
        Metadata: {
          originalFilename: encodeURIComponent(`${body.title?.trim() || 'Signing packet'}.pdf`),
          uploadedBy: userId,
          packetDocumentCount: String(packet.manifest.documentCount),
        },
      }),
    );

    const region = process.env.AWS_REGION || 'us-east-1';
    return NextResponse.json({
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      name: body.title?.trim() || 'Signing packet',
      size: packet.bytes.byteLength,
      packetManifest: packet.manifest,
    });
  } catch (error) {
    logger.error('Packet creation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create packet' },
      { status: 400 },
    );
  }
}
