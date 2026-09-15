import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentAnnotations, documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { id: documentId } = await params;
    const body = await request.json();
    const { annotationData } = body;

    if (!annotationData) {
      return NextResponse.json({ error: 'Annotation data is required' }, { status: 400 });
    }

    return await db.transaction(async (tx) => {
      // Serialize edits with lifecycle transitions on the same document row.
      const [document] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.ownerId, userId)))
        .for('update');

      if (!document || document.deletedAt) {
        return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
      }
      if (document.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Fields can only be changed on a draft' }, { status: 409 });
      }

      // Check if annotation record already exists for this document (e.g., from duplication)
      const existing = await tx.query.documentAnnotations.findFirst({
        where: (ann, { eq }) => eq(ann.documentId, documentId),
      });

      let annotation: typeof existing;
      if (existing) {
        // Update existing annotation record
        const updated = await tx
          .update(documentAnnotations)
          .set({
            annotationData,
            creatorId: userId,
          })
          .where(eq(documentAnnotations.id, existing.id))
          .returning();
        annotation = updated[0];
      } else {
        // Create new annotation record
        const created = await tx
          .insert(documentAnnotations)
          .values({
            id: crypto.randomUUID(),
            documentId,
            creatorId: userId,
            annotationData,
            createdAt: new Date(),
            isFinalized: false,
          })
          .returning();
        annotation = created[0];
      }

      logger.info('Document annotations saved', { documentId, annotationId: annotation.id });

      return NextResponse.json({ annotation });
    });
  } catch (error) {
    logger.error('Error saving document annotations', error);
    return NextResponse.json({ error: 'Failed to save annotations' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { id: documentId } = await params;

    // Verify document exists and user owns it
    const document = await db.query.documents.findFirst({
      where: (documents, { and, eq }) => and(eq(documents.id, documentId), eq(documents.ownerId, userId)),
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // Get annotations for this document
    const annotations = await db.query.documentAnnotations.findMany({
      where: (documentAnnotations, { eq }) => eq(documentAnnotations.documentId, documentId),
      orderBy: (documentAnnotations, { asc }) => [asc(documentAnnotations.createdAt)],
    });

    return NextResponse.json({ annotations });
  } catch (error) {
    logger.error('Error fetching document annotations', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}
