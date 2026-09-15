import { and, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AppFrame } from '@/components/sign-design/app-frame';
import { documentParticipants, signatureRequests } from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { auth } from '@/lib/auth/auth-js';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const inboxCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signatureRequests)
    .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
    .where(and(eq(documentParticipants.userId, session.user.id), eq(signatureRequests.status, 'PENDING')));
  const inboxCount = inboxCountResult[0]?.count ?? 0;

  const user = {
    name: session.user.name ?? session.user.email ?? 'Account',
    email: session.user.email ?? '',
  };

  return (
    <AppFrame user={user} inboxCount={inboxCount}>
      {children}
    </AppFrame>
  );
}
