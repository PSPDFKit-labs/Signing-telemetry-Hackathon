import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconDoc } from '@/components/sign-design/icons';
import { StatusPill, type StatusPillStatus } from '@/components/sign-design/status-pill';
import { users } from '@/database/drizzle/auth-schema';
import { documentParticipants, documents, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { OpenSigningRequestButton } from './OpenSigningRequestButton';

export default async function InboxPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Query: Documents that need to be signed by the current user
  const pendingDocuments = await db
    .select({
      documentId: documents.id,
      documentName: documents.name,
      documentCreatedAt: documents.createdAt,
      documentExpiresAt: documents.expiresAt,
      ownerId: documents.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      participantId: documentParticipants.id,
      signatureRequestId: signatureRequests.id,
      signatureStatus: signatureRequests.status,
      requestedAt: signatureRequests.requestedAt,
      accessToken: signatureRequests.accessToken,
      signingOrder: documentParticipants.signingOrder,
      requireSequentialSigning: documents.requireSequentialSigning,
    })
    .from(documentParticipants)
    .innerJoin(documents, eq(documentParticipants.documentId, documents.id))
    .leftJoin(users, eq(documents.ownerId, users.id))
    .innerJoin(signatureRequests, eq(signatureRequests.participantId, documentParticipants.id))
    .where(
      and(
        eq(documentParticipants.userId, session.user.id),
        eq(signatureRequests.status, 'PENDING'),
        isNull(documents.deletedAt), // Exclude deleted documents
      ),
    )
    .orderBy(desc(signatureRequests.requestedAt));

  // For sequential signing, filter out documents where it's not yet the user's turn
  // (i.e., there are still pending signatures from participants with lower signing order)
  const documentsToSign = await Promise.all(
    pendingDocuments.map(async (doc) => {
      // If signing order is 0, it's always their turn
      if (!doc.requireSequentialSigning || doc.signingOrder === 0 || doc.signingOrder === null) {
        return doc;
      }

      // Check if there are any pending signatures from participants with lower signing order
      const pendingPreviousSigners = await db
        .select({ id: signatureRequests.id })
        .from(signatureRequests)
        .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
        .where(
          and(
            eq(documentParticipants.documentId, doc.documentId),
            lt(documentParticipants.signingOrder, doc.signingOrder),
            eq(signatureRequests.status, 'PENDING'),
          ),
        )
        .limit(1);

      // If there are pending previous signers, it's not this user's turn yet
      if (pendingPreviousSigners.length > 0) {
        return null;
      }

      return doc;
    }),
  ).then((results) => results.filter((doc): doc is NonNullable<typeof doc> => doc !== null));

  // Query: Documents shared with the current user as Viewer
  // CC recipients only receive email copies — they don't appear in-app
  const sharedDocuments = await db
    .select({
      documentId: documents.id,
      documentName: documents.name,
      documentCreatedAt: documents.createdAt,
      documentStatus: documents.status,
      ownerId: documents.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(documentParticipants)
    .innerJoin(documents, eq(documentParticipants.documentId, documents.id))
    .leftJoin(users, eq(documents.ownerId, users.id))
    .where(
      and(
        eq(documentParticipants.userId, session.user.id),
        eq(documentParticipants.accessLevel, 'VIEWER'),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(documents.createdAt));

  // Format relative time
  const formatRelativeTime = (date: Date | null) => {
    if (!date) return 'Unknown';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Check if document is expiring soon (within 3 days)
  const isExpiringSoon = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(diff / 86400000);
    return daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
  };

  // Check if document is expired (expires at end of day, not start)
  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    const endOfDay = new Date(expiresAt);
    endOfDay.setHours(23, 59, 59, 999);
    return new Date() > endOfDay;
  };

  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Inbox</h1>
          <p>Documents requiring your attention.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        {documentsToSign.length === 0 ? (
          <div className="empty">
            <div className="icon">
              <IconDoc />
            </div>
            <h3>Inbox is empty</h3>
            <p>You don&apos;t have any documents waiting for your signature at the moment.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>From</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documentsToSign.map((item) => {
                const expired = isExpired(item.documentExpiresAt);
                const status: StatusPillStatus = expired ? 'expired' : 'pending';
                const expiringSoon = !expired && isExpiringSoon(item.documentExpiresAt);
                return (
                  <tr key={item.signatureRequestId}>
                    <td>
                      <div className="ico-cell">
                        <span className="file-ico">
                          <IconDoc />
                        </span>
                        <span className="doc-name">{item.documentName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="from-name">{item.ownerName || 'Unknown'}</div>
                      <div className="from-email">{item.ownerEmail}</div>
                    </td>
                    <td className="mono" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>
                      {formatRelativeTime(item.requestedAt)}
                      {expiringSoon && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-accent)', marginTop: 2 }}>
                          Expires soon
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusPill status={status} />
                    </td>
                    <td className="actions">
                      {expired ? (
                        <button type="button" className="btn ghost sm" disabled>
                          Expired
                        </button>
                      ) : item.accessToken ? (
                        <OpenSigningRequestButton requestId={item.signatureRequestId} />
                      ) : (
                        <button type="button" className="btn ghost sm" disabled>
                          No access
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Shared with you</h2>
          <p>Documents shared with you for viewing.</p>
        </div>
        {sharedDocuments.length === 0 ? (
          <div className="empty">
            <div className="icon">
              <IconDoc />
            </div>
            <h3>No shared documents</h3>
            <p>You don&apos;t have any documents shared with you at the moment.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>From</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sharedDocuments.map((item) => {
                const sharedStatus: StatusPillStatus =
                  item.documentStatus === 'COMPLETED'
                    ? 'signed'
                    : item.documentStatus === 'CANCELLED'
                      ? 'expired'
                      : 'pending';
                return (
                  <tr key={item.documentId}>
                    <td>
                      <div className="ico-cell">
                        <span className="file-ico">
                          <IconDoc />
                        </span>
                        <span className="doc-name">{item.documentName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="from-name">{item.ownerName || 'Unknown'}</div>
                      <div className="from-email">{item.ownerEmail}</div>
                    </td>
                    <td className="mono" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>
                      {formatRelativeTime(item.documentCreatedAt)}
                    </td>
                    <td>
                      <StatusPill status={sharedStatus} />
                    </td>
                    <td className="actions">
                      <Link href={`/documents/${item.documentId}`} className="btn ghost sm">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
