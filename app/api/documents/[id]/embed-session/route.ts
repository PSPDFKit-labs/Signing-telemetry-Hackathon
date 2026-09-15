import { and, eq, isNull, lt } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  documentAuditLog,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { isDocumentExpired } from '@/lib/document-expiration';
import { SIGNING_EMBED_EVENT_TYPES, SIGNING_EMBED_PROTOCOL, SIGNING_EMBED_VERSION } from '@/lib/embed-contract';
import { logger } from '@/lib/logger';
import { createSigningToken } from '@/lib/signing-tokens';

export const runtime = 'nodejs';

interface EmbedSessionBody {
  participantId?: string;
  signatureRequestId?: string;
}

function applicationOrigin(request: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return request.nextUrl.origin;
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = session.user.id;

    const { id: documentId } = await params;
    const body = (await request.json()) as EmbedSessionBody;
    if (!body.participantId && !body.signatureRequestId) {
      return NextResponse.json({ error: 'participantId or signatureRequestId is required' }, { status: 400 });
    }

    const selector = body.signatureRequestId
      ? eq(signatureRequests.id, body.signatureRequestId)
      : eq(signatureRequests.participantId, body.participantId as string);
    const rows = await db
      .select({ document: documents, participant: documentParticipants, signatureRequest: signatureRequests })
      .from(signatureRequests)
      .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
      .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
      .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId), selector))
      .limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'Pending signer not found' }, { status: 404 });
    if (row.participant.accessLevel !== 'SIGNER' || row.signatureRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending signer requests can be embedded' }, { status: 409 });
    }
    if (row.document.status !== 'PENDING' && row.document.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Document is not open for electronic signing' }, { status: 409 });
    }
    if (row.document.signingMethod !== 'ELECTRONIC') {
      return NextResponse.json({ error: 'Wet-sign documents cannot be embedded' }, { status: 409 });
    }
    if (row.document.deletedAt || isDocumentExpired(row.document.expiresAt)) {
      return NextResponse.json({ error: 'Document is expired or unavailable' }, { status: 410 });
    }

    if (row.document.requireSequentialSigning && (row.participant.signingOrder ?? 0) > 0) {
      const earlierPending = await db
        .select({ id: signatureRequests.id })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .where(
          and(
            eq(signatureRequests.documentId, documentId),
            eq(signatureRequests.status, 'PENDING'),
            lt(documentParticipants.signingOrder, row.participant.signingOrder ?? 0),
          ),
        )
        .limit(1);
      if (earlierPending.length > 0) {
        return NextResponse.json({ error: 'This signer is not active yet' }, { status: 409 });
      }
    }

    const token = createSigningToken();
    const unchangedToken = row.signatureRequest.accessToken
      ? eq(signatureRequests.accessToken, row.signatureRequest.accessToken)
      : isNull(signatureRequests.accessToken);
    const rotated = await db.transaction(async (tx) => {
      const updated = await tx
        .update(signatureRequests)
        .set({ accessToken: token.storedToken, requestedAt: new Date() })
        .where(
          and(
            eq(signatureRequests.id, row.signatureRequest.id),
            eq(signatureRequests.status, 'PENDING'),
            unchangedToken,
          ),
        )
        .returning();
      if (updated.length === 0) return false;

      await tx.insert(documentAuditLog).values({
        id: crypto.randomUUID(),
        documentId,
        userId: ownerId,
        action: 'EMBED_SESSION_CREATED',
        details: { participantId: row.participant.id, signatureRequestId: row.signatureRequest.id },
        createdAt: new Date(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
      return true;
    });
    if (!rotated) {
      return NextResponse.json({ error: 'Signing request changed; create a new embed session' }, { status: 409 });
    }

    return NextResponse.json(
      {
        embedUrl: `${applicationOrigin(request)}/embed/sign/${token.rawToken}`,
        expiresAt: row.document.expiresAt,
        participantId: row.participant.id,
        signatureRequestId: row.signatureRequest.id,
        protocol: { source: SIGNING_EMBED_PROTOCOL, version: SIGNING_EMBED_VERSION },
        events: SIGNING_EMBED_EVENT_TYPES,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Could not create signing embed session', error);
    return NextResponse.json({ error: 'Failed to create signing embed session' }, { status: 500 });
  }
}
