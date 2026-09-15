import { type NextRequest, NextResponse } from 'next/server';
import { documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';
import { isUserUploadPath } from '@/lib/storage-path';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = (await request.json()) as {
      name?: string;
      documentFilePath?: string;
      templateId?: string;
      expiresAt?: string;
      size?: number;
      requireSequentialSigning?: boolean;
      packetManifest?: unknown;
      finalizationMode?: unknown;
      signingMethod?: unknown;
    };
    const {
      name,
      documentFilePath,
      templateId,
      expiresAt,
      size,
      requireSequentialSigning,
      packetManifest,
      finalizationMode,
      signingMethod,
    } = body;

    // Validate required fields
    if (!name || !documentFilePath) {
      return NextResponse.json({ error: 'Document name and file path are required' }, { status: 400 });
    }

    let trustedDocumentFilePath = documentFilePath;
    let trustedPacketManifest = packetManifest || null;
    let trustedTemplateId = templateId || null;
    if (templateId) {
      const template = await db.query.documentTemplates.findFirst({
        where: (templates, { and, eq, or }) =>
          and(eq(templates.id, templateId), or(eq(templates.creatorId, userId), eq(templates.isSystem, true))),
      });
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      trustedDocumentFilePath = template.templateFilePath;
      trustedPacketManifest = template.packetManifest ?? null;
    } else if (!isUserUploadPath(documentFilePath, userId)) {
      // A system sample may reach this endpoint from a saved quick-start state
      // without its template ID. Resolve only an exact built-in path; all other
      // non-owner paths remain forbidden.
      const systemTemplate = await db.query.documentTemplates.findFirst({
        where: (templates, { and, eq }) =>
          and(eq(templates.isSystem, true), eq(templates.templateFilePath, documentFilePath)),
      });
      if (!systemTemplate) return NextResponse.json({ error: 'Document file path is not owned by this user' }, { status: 403 });
      trustedDocumentFilePath = systemTemplate.templateFilePath;
      trustedPacketManifest = systemTemplate.packetManifest ?? null;
      trustedTemplateId = systemTemplate.id;
    }

    // Create document record
    const document = await db
      .insert(documents)
      .values({
        id: crypto.randomUUID(),
        name,
        documentFilePath: trustedDocumentFilePath,
        templateId: trustedTemplateId,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        size: size || null,
        documentFileHash: null,
        packetManifest: trustedPacketManifest,
        finalizationMode: finalizationMode === 'ELECTRONIC' ? 'ELECTRONIC' : 'DIGITAL_SEAL',
        signingMethod: signingMethod === 'WET' ? 'WET' : 'ELECTRONIC',
        requireSequentialSigning: requireSequentialSigning ?? false,
      })
      .returning();

    logger.info('Document created', { documentId: document[0].id, userId });

    return NextResponse.json({ document: document[0] });
  } catch (error) {
    logger.error('Error creating document', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get user's documents
    const userDocuments = await db.query.documents.findMany({
      where: (documents, { eq }) => eq(documents.ownerId, userId),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });

    return NextResponse.json({ documents: userDocuments });
  } catch (error) {
    logger.error('Error fetching documents', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
