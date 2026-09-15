import { timingSafeEqual } from 'node:crypto';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { users } from '@/database/drizzle/auth-schema';
import { db } from '@/database/drizzle/drizzle';
import { isEmailDomainAllowed } from '@/lib/auth/allowed-email-domain';
import { isLocalDemo } from '@/lib/local-demo';

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Next.js evaluates this module while collecting build metadata, where a
  // deployment's runtime secrets may intentionally be unavailable.
  adapter: process.env.DATABASE_URL ? DrizzleAdapter(db) : undefined,
  pages: {
    signIn: '/login',
    error: '/error',
    newUser: '/dashboard',
  },
  providers: [
    ...(isLocalDemo()
      ? [
          Credentials({
            id: 'local-demo',
            name: 'Local evaluation',
            credentials: { password: { type: 'password' } },
            async authorize(credentials) {
              if (!isLocalDemo() || typeof credentials.password !== 'string') return null;
              const expected = Buffer.from(process.env.LOCAL_DEMO_PASSWORD || '');
              const actual = Buffer.from(credentials.password);
              if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
              const email = 'coordinator@resident-demo.test';
              await db
                .insert(users)
                .values({ id: 'local-demo-coordinator', name: 'Demo Coordinator', email })
                .onConflictDoNothing({ target: users.email });
              const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
              return user || null;
            },
          }),
        ]
      : []),
    Google({}),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt', // Ensure JWT strategy is used for sessionj
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'local-demo') return isLocalDemo();
      if (!isEmailDomainAllowed(user.email)) return false;

      // After the adapter has created/updated the user, fetch the Microsoft
      // profile photo and store it in the `photo` column. The `image` column
      // is set to a lightweight proxy URL that serves the photo from the DB.
      // This avoids putting base64 data URIs in the JWT cookie (HTTP 431).
      if (account?.provider === 'microsoft-entra-id' && account.access_token && user.id) {
        try {
          const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
            headers: { Authorization: `Bearer ${account.access_token}` },
          });
          if (photoResponse.ok) {
            const buffer = await photoResponse.arrayBuffer();
            const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
            const base64 = Buffer.from(buffer).toString('base64');
            const dataUri = `data:${contentType};base64,${base64}`;
            await db
              .update(users)
              .set({ photo: dataUri, image: `/api/avatar/${user.id}` })
              .where(eq(users.id, user.id));
          }
        } catch (error) {
          console.warn('Failed to fetch Microsoft profile photo:', error);
        }
      }
      return true;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      // Ensure session image uses the proxy URL, never a data URI
      if (typeof token.picture === 'string') {
        session.user.image = token.picture;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Re-read image from DB because the signIn callback may have updated it
        // after the adapter initially populated the user object.
        const freshUser = await db
          .select({ image: users.image })
          .from(users)
          .where(eq(users.id, user.id as string))
          .limit(1);
        if (freshUser.length > 0 && freshUser[0].image) {
          token.picture = freshUser[0].image;
        }
      }
      // Safety: never allow data URIs in the JWT (bloats cookie → HTTP 431)
      if (typeof token.picture === 'string' && token.picture.startsWith('data:')) {
        token.picture = null;
      }
      return token;
    },
  },
});
