import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { users } from '@/database/drizzle/auth-schema';
import { documentParticipants } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: documentId } = await params;

    // Fetch document (must be owned by current user)
    const document = await db.query.documents.findFirst({
      where: (documents, { and, eq }) => and(eq(documents.id, documentId), eq(documents.ownerId, userId)),
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // Fetch participants with user info
    const participants = await db
      .select({
        id: documentParticipants.id,
        userId: documentParticipants.userId,
        accessLevel: documentParticipants.accessLevel,
        signingOrder: documentParticipants.signingOrder,
        isRequired: documentParticipants.isRequired,
        userName: users.name,
        userEmail: users.email,
      })
      .from(documentParticipants)
      .innerJoin(users, eq(documentParticipants.userId, users.id))
      .where(eq(documentParticipants.documentId, documentId));

    // Fetch annotations
    const annotations = await db.query.documentAnnotations.findFirst({
      where: (ann, { eq }) => eq(ann.documentId, documentId),
    });

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        documentFilePath: document.documentFilePath,
        size: document.size,
        requireSequentialSigning: document.requireSequentialSigning,
        expiresAt: document.expiresAt?.toISOString() || null,
        finalizationMode: document.finalizationMode,
        signingMethod: document.signingMethod,
      },
      recipients: participants.map((p) => ({
        id: p.id,
        name: p.userName || '',
        email: p.userEmail || '',
        role: p.accessLevel === 'SIGNER' ? 'signer' : p.accessLevel === 'VIEWER' ? 'viewer' : 'cc',
        signingOrder: p.signingOrder ?? 0,
        isOwner: p.userId === userId,
      })),
      annotations: annotations?.annotationData || null,
    });
  } catch (error) {
    logger.error('Error fetching duplicate data', error);
    return NextResponse.json({ error: 'Failed to fetch duplicate data' }, { status: 500 });
  }
}
