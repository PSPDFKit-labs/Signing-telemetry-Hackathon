import { and, desc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconDoc, IconEye } from '@/components/sign-design/icons';
import { StatusPill } from '@/components/sign-design/status-pill';
import { users } from '@/database/drizzle/auth-schema';
import { documentParticipants, documents, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { DeleteButton } from '../documents/components/DeleteButton';

export default async function SignedDocumentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Query: Documents that the current user has signed (as a participant, not owner)
  const signedDocuments = await db
    .select({
      documentId: documents.id,
      documentName: documents.name,
      documentCreatedAt: documents.createdAt,
      ownerId: documents.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      signatureRequestId: signatureRequests.id,
      signedAt: signatureRequests.signedAt,
    })
    .from(documentParticipants)
    .innerJoin(documents, eq(documentParticipants.documentId, documents.id))
    .leftJoin(users, eq(documents.ownerId, users.id))
    .innerJoin(signatureRequests, eq(signatureRequests.participantId, documentParticipants.id))
    .where(
      and(
        eq(documentParticipants.userId, session.user.id),
        eq(signatureRequests.status, 'SIGNED'),
        isNull(documents.deletedAt), // Not deleted
      ),
    )
    .orderBy(desc(signatureRequests.signedAt));

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
          <h1 className="app-h1">Signed</h1>
          <p>Documents you've signed.</p>
        </div>
      </div>

      {signedDocuments.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="icon">
              <IconDoc />
            </div>
            <h3>No signed documents</h3>
            <p>Documents you sign will appear here for your records.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>From</th>
                <th>Signed</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {signedDocuments.map((doc) => (
                <tr key={doc.signatureRequestId}>
                  <td>
                    <div className="ico-cell">
                      <span className="file-ico">
                        <IconDoc />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className="doc-name">{doc.documentName}</span>
                        <span
                          style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}
                        >
                          ID: {doc.documentId.slice(0, 8)}…
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="from-name">{doc.ownerName || 'Unknown'}</div>
                    <div className="from-email">{doc.ownerEmail}</div>
                  </td>
                  <td className="mono" style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatRelativeTime(doc.signedAt)}
                  </td>
                  <td>
                    <StatusPill status="signed" />
                  </td>
                  <td className="actions">
                    <Link href={`/documents/${doc.documentId}`} className="btn ghost sm" title="View">
                      <IconEye />
                    </Link>
                    <DeleteButton documentId={doc.documentId} documentName={doc.documentName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
