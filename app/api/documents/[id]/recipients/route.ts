import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { users } from '@/database/drizzle/auth-schema';
import { documentParticipants, documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = session.user.id;

    const { id: documentId } = await params;
    const body = await request.json();
    const { recipients } = body;

    if (!recipients || !Array.isArray(recipients)) {
      return NextResponse.json({ error: 'Recipients array is required' }, { status: 400 });
    }

    return await db.transaction(async (tx) => {
      // Lock before replacing recipients so failed edits roll back and sends cannot race the edit.
      const documentResults = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId)))
        .for('update');

      if (documentResults.length === 0 || documentResults[0].deletedAt) {
        return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
      }
      if (documentResults[0].status !== 'DRAFT') {
        return NextResponse.json({ error: 'Recipients can only be changed on a draft' }, { status: 409 });
      }

      // First, delete existing participants to allow re-configuration
      await tx.delete(documentParticipants).where(eq(documentParticipants.documentId, documentId));

      // Create participant records for each recipient
      const createdParticipants = [];
      for (const recipient of recipients) {
        let recipientUserId = recipient.userId;

        // If no userId provided, try to find or create a user by email
        if (!recipientUserId && recipient.email) {
          // Try to find existing user by email
          const existingUsers = await tx.select().from(users).where(eq(users.email, recipient.email)).limit(1);

          if (existingUsers.length > 0) {
            recipientUserId = existingUsers[0].id;
          } else {
            // Create a placeholder user for this email
            const newUser = await tx
              .insert(users)
              .values({
                id: crypto.randomUUID(),
                email: recipient.email,
                name: recipient.name || recipient.email,
                emailVerified: null,
              })
              .returning();

            recipientUserId = newUser[0].id;
          }
        }

        // Fallback to session user if still no userId
        if (!recipientUserId) {
          recipientUserId = ownerId;
        }

        // Use the frontend-provided ID if available (to match field annotations),
        // otherwise generate a new UUID
        const participantId = recipient.id || crypto.randomUUID();

        const participant = await tx
          .insert(documentParticipants)
          .values({
            id: participantId,
            documentId,
            userId: recipientUserId,
            accessLevel:
              recipient.accessLevel ||
              (recipient.role === 'viewer' ? 'VIEWER' : recipient.role === 'editor' ? 'EDITOR' : 'SIGNER'),
            signingOrder: recipient.signingOrder || 0,
            isRequired: recipient.isRequired !== false,
          })
          .returning();

        createdParticipants.push(participant[0]);
      }

      logger.info('Document participants created', { documentId, count: createdParticipants.length });

      return NextResponse.json({ participants: createdParticipants });
    });
  } catch (error) {
    logger.error('Error creating document participants', error);
    return NextResponse.json({ error: 'Failed to create participants' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: documentId } = await params;

    // Verify document exists and user owns it
    const documentResults = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.ownerId, session.user.id)))
      .limit(1);

    if (documentResults.length === 0) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // Get participants for this document
    const participants = await db
      .select()
      .from(documentParticipants)
      .where(eq(documentParticipants.documentId, documentId))
      .orderBy(documentParticipants.signingOrder);

    return NextResponse.json({ participants });
  } catch (error) {
    logger.error('Error fetching document participants', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}
