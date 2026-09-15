import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FieldTile } from '@/components/sign-design/field-tile';
import { IconCheck, IconClock, IconDoc, IconInbox, IconSend } from '@/components/sign-design/icons';
import { StatCard } from '@/components/sign-design/stat-card';
import { StatusPill } from '@/components/sign-design/status-pill';
import {
  documentAuditLog,
  documentParticipants,
  documents,
  documentTemplates,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { documentDisplayStatus } from '@/lib/document-display-status';

// Hoist static helper functions outside component for better performance
function formatRelativeTime(date: Date | null) {
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
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function formatAuditAction(action: string) {
  const actionMap: Record<string, string> = {
    DOCUMENT_CREATED: 'Document Created',
    DOCUMENT_SENT: 'Document Sent',
    DOCUMENT_VIEWED: 'Document Viewed',
    DOCUMENT_SIGNED: 'Document Signed',
    DOCUMENT_DECLINED: 'Document Declined',
    DOCUMENT_COMPLETED: 'Document Completed',
    DOCUMENT_EXPIRED: 'Document Expired',
    DOCUMENT_DELETED: 'Document Deleted',
    RECIPIENT_ADDED: 'Recipient Added',
    RECIPIENT_REMOVED: 'Recipient Removed',
    FIELD_ADDED: 'Field Added',
    FIELD_UPDATED: 'Field Updated',
    FIELD_REMOVED: 'Field Removed',
    EMAIL_SENT: 'Email Sent',
    REMINDER_SENT: 'Reminder Sent',
  };

  return (
    actionMap[action] ||
    action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  );
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Start all independent queries in parallel for 2-5× performance improvement
  const userDocumentsPromise = db
    .select({
      id: documents.id,
      name: documents.name,
      createdAt: documents.createdAt,
      expiresAt: documents.expiresAt,
      status: documents.status,
    })
    .from(documents)
    .where(and(eq(documents.ownerId, session.user.id), isNull(documents.deletedAt)))
    .orderBy(desc(documents.updatedAt))
    .limit(10);

  const pendingSignaturesPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(signatureRequests)
    .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
    .where(and(eq(documentParticipants.userId, session.user.id), eq(signatureRequests.status, 'PENDING')));

  const totalDocumentsPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.ownerId, session.user.id), isNull(documents.deletedAt)));

  const completedSignaturesPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.ownerId, session.user.id), eq(documents.status, 'COMPLETED'), isNull(documents.deletedAt)));

  const inProgressPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, session.user.id),
        inArray(documents.status, ['PENDING', 'IN_PROGRESS']),
        isNull(documents.deletedAt),
      ),
    );

  const recentActivityPromise = db
    .select({
      id: documentAuditLog.id,
      action: documentAuditLog.action,
      details: documentAuditLog.details,
      createdAt: documentAuditLog.createdAt,
      documentId: documentAuditLog.documentId,
      documentName: documents.name,
    })
    .from(documentAuditLog)
    .leftJoin(documents, eq(documentAuditLog.documentId, documents.id))
    .where(eq(documentAuditLog.userId, session.user.id))
    .orderBy(desc(documentAuditLog.createdAt))
    .limit(5);

  const systemTemplatesPromise = db.query.documentTemplates.findMany({
    where: (documentTemplates, { eq }) => eq(documentTemplates.isSystem, true),
    orderBy: [desc(documentTemplates.createdAt)],
  });

  // Await all independent queries in parallel
  const [
    userDocuments,
    pendingSignaturesResult,
    totalDocumentsResult,
    completedSignaturesResult,
    inProgressResult,
    recentActivity,
    systemTemplates,
  ] = await Promise.all([
    userDocumentsPromise,
    pendingSignaturesPromise,
    totalDocumentsPromise,
    completedSignaturesPromise,
    inProgressPromise,
    recentActivityPromise,
    systemTemplatesPromise,
  ]);

  // Get recipient counts (depends on userDocuments result)
  const documentIds = userDocuments.map((doc) => doc.id);
  const recipientCounts =
    documentIds.length > 0
      ? await db
          .select({
            documentId: documentParticipants.documentId,
            count: sql<number>`count(*)::int`,
          })
          .from(documentParticipants)
          .where(inArray(documentParticipants.documentId, documentIds))
          .groupBy(documentParticipants.documentId)
      : [];

  // Map recipient counts to documents
  const documentsWithCounts = userDocuments.map((doc) => ({
    ...doc,
    recipientCount: recipientCounts.find((rc) => rc.documentId === doc.id)?.count || 0,
  }));

  const pendingSignatures = pendingSignaturesResult[0]?.count || 0;
  const totalDocuments = totalDocumentsResult[0]?.count || 0;
  const completedSignatures = completedSignaturesResult[0]?.count || 0;
  const inProgress = inProgressResult[0]?.count || 0;

  const firstName = session.user.name?.split(' ')[0] ?? 'there';

  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Dashboard</h1>
          <p>Welcome back, {firstName}. Here&apos;s what needs your attention.</p>
        </div>
        <Link href="/send" className="btn">
          <IconSend /> Send document
        </Link>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Action needed"
          value={pendingSignatures}
          sub="awaiting your signature"
          icon={<IconInbox />}
          accent
        />
        <StatCard label="In progress" value={inProgress} sub="awaiting others" icon={<IconClock />} />
        <StatCard label="Completed" value={completedSignatures} sub="completed records" icon={<IconCheck />} />
        <StatCard label="Documents" value={totalDocuments} sub="all time · includes drafts" icon={<IconDoc />} />
      </div>

      {systemTemplates.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="card-head">
            <h2>Quick start</h2>
            <p>Send a sample document or start from scratch.</p>
          </div>
          <div className="card-body">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {systemTemplates.map((t) => (
                <FieldTile key={t.id} href={`/send?templateId=${t.id}`} icon={<IconDoc />} accentIcon>
                  {t.name}
                </FieldTile>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <div className="card">
          <div className="card-head">
            <h2>Recent documents</h2>
            <p>Your recently updated documents, including drafts.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {documentsWithCounts.length === 0 ? (
              <div className="empty">
                <div className="icon">
                  <IconDoc />
                </div>
                <h3>No documents yet</h3>
                <p>Send your first document to get started.</p>
              </div>
            ) : (
              documentsWithCounts.map((doc, i) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: 'var(--space-3) var(--space-5)',
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                    textDecoration: 'none',
                  }}
                >
                  <span className="file-ico" style={{ width: 28, height: 28 }}>
                    <IconDoc />
                  </span>
                  <span style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        color: 'var(--ink)',
                        fontWeight: 500,
                        fontSize: 'var(--text-sm)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>
                      {formatRelativeTime(doc.createdAt)}
                      {doc.recipientCount > 0 && (
                        <>
                          {' · '}
                          {doc.recipientCount} {doc.recipientCount === 1 ? 'recipient' : 'recipients'}
                        </>
                      )}
                    </div>
                  </span>
                  <StatusPill status={documentDisplayStatus(doc.status, doc.expiresAt)} />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Recent activity</h2>
            <p>Updates from your account.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.length === 0 ? (
              <div className="empty">
                <div className="icon">
                  <IconCheck />
                </div>
                <h3>No activity yet</h3>
              </div>
            ) : (
              recentActivity.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: 'var(--space-3) var(--space-5)',
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--brand-accent)',
                      margin: '0 10px',
                    }}
                  />
                  <span>
                    <div
                      style={{
                        color: 'var(--ink)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                      }}
                    >
                      {formatAuditAction(a.action)}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>{a.documentName ?? '—'}</div>
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--ink-4)',
                      letterSpacing: '.04em',
                    }}
                  >
                    {formatRelativeTime(a.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
