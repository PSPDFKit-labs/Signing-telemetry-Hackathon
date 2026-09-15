import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconDoc, IconEye, IconSend } from '@/components/sign-design/icons';
import { StatusPill } from '@/components/sign-design/status-pill';
import { documentParticipants, documents, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { sentDocumentStatus } from '@/lib/sent-document-status';
import { CancelButton } from './components/CancelButton';
import { DeleteButton } from './components/DeleteButton';
import { DuplicateButton } from './components/DuplicateButton';

export default async function SentDocumentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Query: Documents created/sent by the current user (not deleted)
  const sentDocuments = await db
    .select({
      documentId: documents.id,
      documentName: documents.name,
      documentCreatedAt: documents.createdAt,
      documentExpiresAt: documents.expiresAt,
      documentStatus: documents.status,
      // Count total participants
      totalParticipants: sql<number>`COUNT(DISTINCT ${documentParticipants.id})`,
      signerCount: sql<number>`COUNT(DISTINCT CASE WHEN ${documentParticipants.accessLevel} = 'SIGNER' THEN ${documentParticipants.id} END)`,
      signedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${signatureRequests.status} = 'SIGNED' AND ${documentParticipants.accessLevel} = 'SIGNER' THEN ${documentParticipants.id} END)`,
    })
    .from(documents)
    .leftJoin(documentParticipants, eq(documentParticipants.documentId, documents.id))
    .leftJoin(signatureRequests, eq(signatureRequests.participantId, documentParticipants.id))
    .where(
      and(
        eq(documents.ownerId, session.user.id),
        isNull(documents.deletedAt), // Not deleted
      ),
    )
    .groupBy(documents.id, documents.name, documents.createdAt, documents.expiresAt, documents.status)
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

  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Sent</h1>
          <p>Your drafts, signing requests, and completed documents.</p>
        </div>
        <Link href="/send" className="btn">
          <IconSend /> Send document
        </Link>
      </div>

      {sentDocuments.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="icon">
              <IconDoc />
            </div>
            <h3>No sent documents</h3>
            <p>Documents you send for signature will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Recipients</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sentDocuments.map((doc) => {
                const statusInfo = sentDocumentStatus(
                  doc.documentStatus,
                  doc.documentExpiresAt,
                  doc.signerCount,
                  doc.signedCount,
                );
                const partialLabel = statusInfo.progress;
                return (
                  <tr key={doc.documentId}>
                    <td>
                      <div className="ico-cell">
                        <span className="file-ico">
                          <IconDoc />
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className="doc-name">{doc.documentName}</span>
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
                    <td className="mono" style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {doc.totalParticipants}
                    </td>
                    <td className="mono" style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRelativeTime(doc.documentCreatedAt)}
                    </td>
                    <td>
                      <StatusPill status={statusInfo.pill} />
                      {partialLabel && (
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--ink-4)',
                            marginTop: 4,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {partialLabel}
                        </div>
                      )}
                    </td>
                    <td className="actions">
                      <Link href={`/documents/${doc.documentId}`} className="btn ghost sm" title="View">
                        <IconEye />
                      </Link>
                      <DuplicateButton documentId={doc.documentId} documentName={doc.documentName} />
                      <CancelButton
                        documentId={doc.documentId}
                        documentName={doc.documentName}
                        disabled={!statusInfo.canCancel}
                      />
                      <DeleteButton documentId={doc.documentId} documentName={doc.documentName} />
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
