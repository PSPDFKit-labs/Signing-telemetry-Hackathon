import { PutObjectCommand } from '@aws-sdk/client-s3';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';
import { validateUploadContent } from '@/lib/upload-validation';

// Next.js route configuration for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution time
export const dynamic = 'force-dynamic'; // Don't cache uploads

// File upload security configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/tiff',
];

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'tiff', 'tif'];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, Word, Excel, PowerPoint, and image files are allowed.' },
        { status: 400 },
      );
    }

    // Validate file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file extension. Only PDF, Word, Excel, PowerPoint, and image files are allowed.' },
        { status: 400 },
      );
    }

    // Generate secure random filename with proper extension
    const timestamp = Date.now();
    const randomString = crypto.randomUUID().substring(0, 8);
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;
    const key = `uploads/${session.user.id}/${fileName}`;

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentError = validateUploadContent(file.name, file.type, buffer);
    if (contentError) {
      return NextResponse.json({ error: contentError }, { status: 400 });
    }

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          originalFilename: encodeURIComponent(file.name),
          uploadedBy: session.user.id,
        },
      }),
    );

    // Return the S3 URL
    const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return NextResponse.json({
      url,
      originalFilename: file.name,
      size: file.size,
    });
  } catch (error) {
    logger.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
