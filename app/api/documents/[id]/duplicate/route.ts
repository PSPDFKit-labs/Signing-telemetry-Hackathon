import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentAnnotations, documentParticipants, documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { id: sourceDocumentId } = await params;

    // Fetch source document
    const sourceDoc = await db.query.documents.findFirst({
      where: (documents, { eq }) => eq(documents.id, sourceDocumentId),
    });

    if (!sourceDoc?.documentFilePath) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only the document owner can duplicate
    if (sourceDoc.ownerId !== userId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Fetch participants
    const sourceParticipants = await db
      .select()
      .from(documentParticipants)
      .where(eq(documentParticipants.documentId, sourceDocumentId));

    // Fetch annotations (needed for field recreation in the send flow)
    const sourceAnnotation = await db.query.documentAnnotations.findFirst({
      where: (ann, { eq }) => eq(ann.documentId, sourceDocumentId),
    });

    // Create new document and copy participants in a transaction
    const newDocId = crypto.randomUUID();
    const newDoc = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documents)
        .values({
          id: newDocId,
          name: `Copy of ${sourceDoc.name}`,
          documentFilePath: sourceDoc.documentFilePath,
          ownerId: userId,
          size: sourceDoc.size,
          packetManifest: sourceDoc.packetManifest,
          finalizationMode: sourceDoc.finalizationMode,
          signingMethod: sourceDoc.signingMethod,
          requireSequentialSigning: sourceDoc.requireSequentialSigning,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (sourceParticipants.length > 0) {
        await tx.insert(documentParticipants).values(
          sourceParticipants.map((p) => ({
            id: crypto.randomUUID(),
            documentId: newDocId,
            userId: p.userId,
            accessLevel: p.accessLevel,
            signingOrder: p.signingOrder,
            isRequired: p.isRequired,
          })),
        );
      }

      // Copy annotations so duplicate-data can return them for field recreation
      if (sourceAnnotation) {
        await tx.insert(documentAnnotations).values({
          documentId: newDocId,
          creatorId: userId,
          annotationData: sourceAnnotation.annotationData,
          isFinalized: false,
        });
      }

      return doc;
    });

    logger.info('Document duplicated', {
      sourceDocumentId,
      newDocumentId: newDocId,
      userId,
    });

    return NextResponse.json({ document: newDoc });
  } catch (error) {
    logger.error('Error duplicating document', error);
    return NextResponse.json({ error: 'Failed to duplicate document' }, { status: 500 });
  }
}
