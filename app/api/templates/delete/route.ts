import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documents, documentTemplates } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { s3Client } from '@/lib/s3';

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Get template details — only find templates owned by this user
    const template = await db.query.documentTemplates.findFirst({
      where: and(eq(documentTemplates.id, templateId), eq(documentTemplates.creatorId, userId)),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if any documents are using this template (excluding deleted documents)
    const documentsUsingTemplate = await db
      .select({ id: documents.id, name: documents.name })
      .from(documents)
      .where(and(eq(documents.templateId, templateId), isNull(documents.deletedAt)))
      .limit(5);

    if (documentsUsingTemplate.length > 0) {
      const documentNames = documentsUsingTemplate.map((d) => d.name).join(', ');
      return NextResponse.json(
        {
          error: 'Template is in use',
          message: `This template cannot be deleted because it is used by ${documentsUsingTemplate.length} document(s): ${documentNames}`,
        },
        { status: 409 },
      );
    }

    // Delete from S3
    try {
      const key = new URL(template.templateFilePath).pathname.substring(1);
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
        }),
      );
    } catch (error) {
      logger.error('Error deleting file from S3:', error);
    }

    // Delete from database
    await db.delete(documentTemplates).where(eq(documentTemplates.id, templateId));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
