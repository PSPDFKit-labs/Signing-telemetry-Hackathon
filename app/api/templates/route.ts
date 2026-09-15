import { desc } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentTemplates } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await db.query.documentTemplates.findMany({
      where: (documentTemplates, { eq, or }) => {
        const userId = session.user?.id as string;
        return or(eq(documentTemplates.creatorId, userId), eq(documentTemplates.isSystem, true));
      },
      orderBy: [desc(documentTemplates.isSystem), desc(documentTemplates.createdAt)],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const requiredFields = ['name', 'file_url'];
    const missingFields = requiredFields.filter((field) => !data[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Preserve packet provenance only from this owner's persisted source document.
    const source = await db.query.documents.findFirst({
      where: (documents, { and, eq, isNull }) => and(
        eq(documents.ownerId, session.user!.id!),
        eq(documents.documentFilePath, data.file_url),
        isNull(documents.deletedAt),
      ),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });
    const template = await db
      .insert(documentTemplates)
      .values({
        id: crypto.randomUUID(),
        name: data.name,
        templateFilePath: data.file_url,
        templateFileHash: null,
        packetManifest: source?.packetManifest ?? null,
        creatorId: session.user.id,
        createdAt: new Date(),
        size: data.file_size ? Number(data.file_size) : null,
      })
      .returning();

    return NextResponse.json({ template: template[0] });
  } catch (error) {
    logger.error('API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create template',
      },
      { status: 500 },
    );
  }
}
