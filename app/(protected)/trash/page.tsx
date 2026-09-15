import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { IconDoc, IconTrash } from '@/components/sign-design/icons';
import { StatusPill, type StatusPillStatus } from '@/components/sign-design/status-pill';
import { users } from '@/database/drizzle/auth-schema';
import { documentParticipants, documents, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { DeleteAllButton } from './components/DeleteAllButton';
import { TrashActions } from './components/TrashActions';

function deriveTrashStatus(
  documentStatus: string | null,
  expiresAt: Date | null,
  totalParticipants: number,
  signedCount: number,
  declinedCount: number,
): StatusPillStatus {
  if (documentStatus === 'CANCELLED' || declinedCount > 0) return 'expired';
  if (expiresAt && expiresAt < new Date()) return 'expired';
  if (documentStatus === 'COMPLETED' || (totalParticipants > 0 && signedCount === totalParticipants)) return 'signed';
  if (totalParticipants === 0) return 'draft';
  return 'pending';
}

export default async function TrashPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Query: Documents that are deleted (have deletedAt timestamp) with participant counts
  const deletedDocuments = await db
    .select({
      documentId: documents.id,
      documentName: documents.name,
      documentStatus: documents.status,
      documentExpiresAt: documents.expiresAt,
      deletedAt: documents.deletedAt,
      totalParticipants: sql<number>`COUNT(DISTINCT ${documentParticipants.id})`,
      signedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${signatureRequests.status} = 'SIGNED' THEN ${documentParticipants.id} END)`,
      declinedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${signatureRequests.status} = 'DECLINED' THEN ${documentParticipants.id} END)`,
    })
    .from(documents)
    .leftJoin(documentParticipants, eq(documentParticipants.documentId, documents.id))
    .leftJoin(signatureRequests, eq(signatureRequests.participantId, documentParticipants.id))
    .where(and(eq(documents.ownerId, session.user.id), isNotNull(documents.deletedAt)))
    .groupBy(documents.id, documents.name, documents.status, documents.expiresAt, documents.deletedAt)
    .orderBy(desc(documents.deletedAt));

  // Fetch the first (lowest signing-order) recipient per document
  const documentIds = deletedDocuments.map((d) => d.documentId);
  const firstRecipients =
    documentIds.length === 0
      ? []
      : await db
          .selectDistinctOn([documentParticipants.documentId], {
            documentId: documentParticipants.documentId,
            name: users.name,
            email: users.email,
          })
          .from(documentParticipants)
          .leftJoin(users, eq(documentParticipants.userId, users.id))
          .where(inArray(documentParticipants.documentId, documentIds))
          .orderBy(documentParticipants.documentId, documentParticipants.signingOrder);

  const recipientMap = new Map(firstRecipients.map((r) => [r.documentId, { name: r.name, email: r.email }]));

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

  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Trash</h1>
          <p>Documents in your trash. Items are permanently deleted after 30 days.</p>
        </div>
        {deletedDocuments.length > 0 && <DeleteAllButton documentCount={deletedDocuments.length} />}
      </div>

      {deletedDocuments.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="icon">
              <IconTrash />
            </div>
            <h3>Trash is empty</h3>
            <p>Deleted documents will appear here before permanent removal.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>To</th>
                <th>Recipients</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedDocuments.map((doc) => {
                const recipient = recipientMap.get(doc.documentId);
                const status = deriveTrashStatus(
                  doc.documentStatus,
                  doc.documentExpiresAt,
                  doc.totalParticipants,
                  doc.signedCount,
                  doc.declinedCount,
                );
                return (
                  <tr key={doc.documentId}>
                    <td>
                      <div className="ico-cell">
                        <span className="file-ico" style={{ opacity: 0.5 }}>
                          <IconDoc />
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className="doc-name" style={{ color: 'var(--ink-3)' }}>
                            {doc.documentName}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--ink-4)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            ID: {doc.documentId.slice(0, 8)}&hellip;
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      {recipient?.name ? (
                        <>
                          <div className="from-name">{recipient.name}</div>
                          <div className="from-email">{recipient.email}</div>
                        </>
                      ) : (
                        <span className="muted">&mdash;</span>
                      )}
                    </td>
                    <td className="mono" style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {doc.totalParticipants}
                    </td>
                    <td className="mono" style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRelativeTime(doc.deletedAt)}
                    </td>
                    <td>
                      <StatusPill status={status} />
                    </td>
                    <td className="actions">
                      <TrashActions documentId={doc.documentId} documentName={doc.documentName} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
