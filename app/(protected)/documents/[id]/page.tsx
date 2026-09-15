import { Activity, Calendar, Clock, FileText, User, Users } from '@react-zero-ui/icon-sprite';
import { and, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DocumentPreviewDialog } from '@/components/document-preview-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { users } from '@/database/drizzle/auth-schema';
import {
  documentAnnotations,
  documentAuditLog,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';
import { DownloadButton } from './components/DownloadButton';
import { EmbeddedSigning } from './components/EmbeddedSigning';
import { FinalizeButton } from './components/FinalizeButton';
import { ResendDialog } from './components/ResendDialog';
import { StartWetSign, WetSignActions } from './components/WetSignActions';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Hoist static functions outside component for better performance
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
  return date.toLocaleDateString();
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

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Start all independent queries in parallel for 2-5× performance improvement
  const documentPromise = db
    .select({
      id: documents.id,
      name: documents.name,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      expiresAt: documents.expiresAt,
      documentFilePath: documents.documentFilePath,
      signedDocumentFilePath: documents.signedDocumentFilePath,
      status: documents.status,
      size: documents.size,
      ownerId: documents.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      signingMethod: documents.signingMethod,
      wetSignedReturnedAt: documents.wetSignedReturnedAt,
    })
    .from(documents)
    .leftJoin(users, eq(documents.ownerId, users.id))
    .where(eq(documents.id, id))
    .limit(1);

  const recipientsPromise = db
    .select({
      id: documentParticipants.id,
      userId: documentParticipants.userId,
      userName: users.name,
      userEmail: users.email,
      accessLevel: documentParticipants.accessLevel,
      signingOrder: documentParticipants.signingOrder,
      isRequired: documentParticipants.isRequired,
      signatureRequestId: signatureRequests.id,
      signatureStatus: signatureRequests.status,
      signedAt: signatureRequests.signedAt,
    })
    .from(documentParticipants)
    .leftJoin(users, eq(documentParticipants.userId, users.id))
    .leftJoin(signatureRequests, eq(signatureRequests.participantId, documentParticipants.id))
    .where(eq(documentParticipants.documentId, id))
    .orderBy(documentParticipants.signingOrder);

  const annotationsPromise = db
    .select()
    .from(documentAnnotations)
    .where(eq(documentAnnotations.documentId, id))
    .limit(1);

  const auditLogPromise = db
    .select({
      id: documentAuditLog.id,
      action: documentAuditLog.action,
      details: documentAuditLog.details,
      createdAt: documentAuditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(documentAuditLog)
    .leftJoin(users, eq(documentAuditLog.userId, users.id))
    .where(eq(documentAuditLog.documentId, id))
    .orderBy(desc(documentAuditLog.createdAt))
    .limit(10);

  // Await document first to check access
  const documentResult = await documentPromise;

  if (documentResult.length === 0) {
    notFound();
  }

  const document = documentResult[0];

  // Check if user has access to this document
  const hasAccess = document.ownerId === session.user.id;

  if (!hasAccess) {
    // Check if user is a participant
    const participantResult = await db
      .select()
      .from(documentParticipants)
      .where(and(eq(documentParticipants.documentId, id), eq(documentParticipants.userId, session.user.id)))
      .limit(1);

    if (participantResult.length === 0) {
      redirect('/dashboard');
    }
  }

  // Now await all other queries in parallel
  const [recipients, annotations, auditLog] = await Promise.all([
    recipientsPromise,
    annotationsPromise,
    auditLogPromise,
  ]);

  const annotationData = annotations[0]?.annotationData as { formFields?: any[]; annotations?: any[] } | null;
  const fieldCount = annotationData?.formFields?.length || 0;

  // Calculate signature status
  const totalSigners = recipients.filter((r) => r.accessLevel === 'SIGNER').length;
  const signedCount = recipients.filter((r) => r.signatureStatus === 'SIGNED').length;
  const pendingCount = recipients.filter((r) => r.signatureStatus === 'PENDING').length;
  const declinedCount = recipients.filter((r) => r.signatureStatus === 'DECLINED').length;
  const allRequiredSigned = recipients
    .filter((r) => r.accessLevel === 'SIGNER' && r.isRequired !== false)
    .every((r) => r.signatureStatus === 'SIGNED');

  // Prepare signature statuses for the preview renderer
  const signatureStatuses = recipients
    .filter((r) => r.accessLevel === 'SIGNER')
    .map((r) => ({
      participantId: r.id,
      status: (r.signatureStatus || 'PENDING') as 'PENDING' | 'SIGNED' | 'DECLINED' | 'CANCELLED',
      participantName: r.userName || 'Unknown',
      participantEmail: r.userEmail || '',
    }));

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {hasAccess &&
        document.signingMethod === 'ELECTRONIC' &&
        ['PENDING', 'IN_PROGRESS'].includes(document.status || '') &&
        pendingCount > 0 && (
          <EmbeddedSigning
            documentId={document.id}
            recipients={recipients
              .filter((recipient) => recipient.accessLevel === 'SIGNER' && recipient.signatureStatus === 'PENDING')
              .map((recipient) => ({
                id: recipient.id,
                name: recipient.userName || recipient.userEmail || 'Recipient',
              }))}
          />
        )}
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <span>/</span>
            <span>Document Details</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{document.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">ID: {document.id.slice(0, 8)}...</p>
        </div>
        <div className="flex gap-2">
          <DocumentPreviewDialog
            documentName={document.name}
            documentFilePath={document.documentFilePath}
            annotations={annotations[0]?.annotationData || null}
            signatureStatuses={signatureStatuses}
            signedCount={signedCount}
            totalSigners={totalSigners}
            compact
            documentId={document.id}
            signedDocumentFilePath={document.signedDocumentFilePath}
          />
          <DownloadButton
            documentName={document.name}
            documentFilePath={document.documentFilePath}
            annotations={(annotations[0]?.annotationData as Record<string, unknown> | null) ?? null}
            signedDocumentFilePath={document.signedDocumentFilePath ?? null}
            documentId={document.id}
          />
          {hasAccess && document.status === 'IN_PROGRESS' && allRequiredSigned && !document.signedDocumentFilePath && (
            <FinalizeButton documentId={document.id} />
          )}
          {hasAccess && document.status === 'AWAITING_WET_SIGNATURE' && <WetSignActions documentId={document.id} />}
          {hasAccess && document.status === 'DRAFT' && <StartWetSign documentId={document.id} />}
          {hasAccess &&
            document.signingMethod === 'ELECTRONIC' &&
            ['PENDING', 'IN_PROGRESS'].includes(document.status || '') && (
              <ResendDialog
                documentId={document.id}
                documentName={document.name}
                expiresAt={document.expiresAt}
                recipients={recipients.map((r) => ({
                  id: r.id,
                  userName: r.userName,
                  userEmail: r.userEmail,
                  signatureStatus: r.signatureStatus,
                  accessLevel: r.accessLevel,
                }))}
              />
            )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Document Information */}
        <Card>
          <CardHeader>
            <CardTitle>Document Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  File Name
                </p>
                <p className="text-sm text-muted-foreground">{document.name}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Owner
                </p>
                <p className="text-sm text-muted-foreground">{document.ownerName || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{document.ownerEmail}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </p>
                <p className="text-sm text-muted-foreground">
                  {document.createdAt
                    ? new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(document.createdAt)
                    : 'Unknown'}
                </p>
              </div>
            </div>

            {document.expiresAt && (
              <>
                <Separator />
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Expires
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(document.expiresAt)}
                    </p>
                  </div>
                </div>
              </>
            )}

            {document.size && (
              <>
                <Separator />
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">File Size</p>
                    <p className="text-sm text-muted-foreground">{(document.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Signature Status */}
        <Card>
          <CardHeader>
            <CardTitle>Signature Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {signedCount} / {totalSigners}
                </p>
                <p className="text-sm text-muted-foreground">Signatures completed</p>
              </div>
              <div className="flex gap-2">
                {document.status === 'DRAFT' ? (
                  <Badge variant="secondary">Draft — not sent</Badge>
                ) : document.status === 'CANCELLED' ? (
                  <Badge variant="secondary">Cancelled</Badge>
                ) : document.status === 'COMPLETED' ? (
                  <Badge variant="default" className="bg-green-600">
                    {document.signingMethod === 'WET' ? 'Wet signature returned' : 'Completed'}
                  </Badge>
                ) : document.status === 'AWAITING_WET_SIGNATURE' ? (
                  <Badge variant="outline">Awaiting wet-signed return</Badge>
                ) : document.status === 'DECLINED' || declinedCount > 0 ? (
                  <Badge variant="destructive">Declined</Badge>
                ) : allRequiredSigned && document.status === 'IN_PROGRESS' ? (
                  <Badge variant="outline">Finalization pending</Badge>
                ) : pendingCount > 0 ? (
                  <Badge variant="outline">In Progress</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recipients ({recipients.length})
              </p>
              {recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between p-2 border border-zinc-200 dark:border-zinc-700 rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{recipient.userName || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{recipient.userEmail}</p>
                    {recipient.signingOrder !== null && recipient.signingOrder > 0 && (
                      <p className="text-xs text-muted-foreground">Order: {recipient.signingOrder}</p>
                    )}
                  </div>
                  <div className="ml-2">
                    {recipient.accessLevel === 'VIEWER' ? (
                      <Badge variant="secondary" className="text-xs">
                        Viewer
                      </Badge>
                    ) : recipient.accessLevel === 'CC' ? (
                      <Badge variant="secondary" className="text-xs">
                        CC
                      </Badge>
                    ) : recipient.signatureStatus === 'SIGNED' ? (
                      <Badge variant="default" className="text-xs bg-green-600">
                        Signed
                      </Badge>
                    ) : recipient.signatureStatus === 'DECLINED' ? (
                      <Badge variant="destructive" className="text-xs">
                        Declined
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Field Information */}
        <Card>
          <CardHeader>
            <CardTitle>Field Placements</CardTitle>
            <CardDescription>Signature fields placed on the document</CardDescription>
          </CardHeader>
          <CardContent>
            {fieldCount === 0 ? (
              <div className="text-center py-6">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No fields placed</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-2xl font-semibold tabular-nums">{fieldCount}</p>
                <p className="text-sm text-muted-foreground">Total fields placed</p>

                {annotationData?.formFields && (
                  <div className="mt-4 space-y-2">
                    {Object.entries(
                      annotationData.formFields.reduce((acc: Record<string, number>, field: any) => {
                        const rawType: string = field.type ?? '';
                        const type = rawType.split('/').pop() ?? rawType;
                        acc[type] = (acc[type] || 0) + 1;
                        return acc;
                      }, {}),
                    ).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Activity history for this document</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="text-center py-6">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No activity recorded</p>
              </div>
            ) : (
              <div className="space-y-4">
                {auditLog.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0">
                      <Activity className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium">{formatAuditAction(log.action)}</p>
                      {log.userName && <p className="text-xs text-muted-foreground">by {log.userName}</p>}
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
