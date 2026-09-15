import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { documentParticipants, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { createSigningToken } from '@/lib/signing-tokens';

/** Opens a pending signing request from the authenticated inbox without ever exposing its stored token hash. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = (await request.json()) as { requestId?: string };
  if (!requestId) return NextResponse.json({ error: 'requestId is required' }, { status: 400 });

  const rows = await db
    .select({ request: signatureRequests, participant: documentParticipants })
    .from(signatureRequests)
    .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
    .where(and(eq(signatureRequests.id, requestId), eq(documentParticipants.userId, session.user.id)))
    .limit(1);
  const row = rows[0];
  if (row?.request.status !== 'PENDING' || !row.request.accessToken) {
    return NextResponse.json({ error: 'Signing request is unavailable' }, { status: 404 });
  }

  const token = createSigningToken();
  const updated = await db
    .update(signatureRequests)
    .set({ accessToken: token.storedToken })
    .where(and(eq(signatureRequests.id, requestId), eq(signatureRequests.status, 'PENDING')))
    .returning();
  if (updated.length === 0) return NextResponse.json({ error: 'Signing request is unavailable' }, { status: 409 });

  return NextResponse.json({ url: `/sign/${token.rawToken}` });
}
