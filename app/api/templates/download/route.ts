import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get template ID from URL params
    const searchParams = req.nextUrl.searchParams;
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Find the template in the database
    const template = await db.query.documentTemplates.findFirst({
      where: (templates, { and, eq }) => and(eq(templates.id, templateId), eq(templates.creatorId, userId)),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Extract the file key from the S3 URL
    let fileKey = '';
    try {
      const urlObj = new URL(template.templateFilePath);
      fileKey = urlObj.pathname.substring(1);

      // Remove bucket name if present in the path
      const bucketName = process.env.AWS_S3_BUCKET_NAME || 'nutrient-sign';
      if (fileKey.startsWith(`${bucketName}/`)) {
        fileKey = fileKey.substring(bucketName.length + 1);
      }
    } catch (error) {
      logger.error('Error parsing file URL:', error);
      return NextResponse.json({ error: 'Invalid template URL' }, { status: 400 });
    }

    if (!fileKey) {
      return NextResponse.json({ error: 'Could not determine file key' }, { status: 400 });
    }

    // Create a command to get the object from S3
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || 'nutrient-sign',
      Key: fileKey,
    });

    // Generate a pre-signed URL with 1 hour expiration
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({
      name: template.name,
      url: presignedUrl,
    });
  } catch (error) {
    logger.error('Error fetching template for download:', error);
    return NextResponse.json({ error: 'Failed to fetch template for download' }, { status: 500 });
  }
}
