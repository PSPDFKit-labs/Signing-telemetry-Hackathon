import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documents } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { logger } from '@/lib/logger';

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Soft delete: Set deletedAt timestamp
    const result = await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.ownerId, session.user.id),
          isNull(documents.deletedAt), // Only delete if not already deleted
        ),
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Document not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Document moved to trash' });
  } catch (error) {
    logger.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
