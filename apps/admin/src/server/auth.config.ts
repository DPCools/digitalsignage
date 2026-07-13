import type { NextAuthConfig } from 'next-auth';

// Edge-safe half of the NextAuth config — imported by middleware.ts, which
// runs in the Edge runtime and cannot pull in Node-only modules (Prisma,
// bcryptjs both reach into Node's `crypto`). Deliberately has NO providers:
// middleware only needs to read/validate the JWT session cookie via the
// callbacks below, never calls a provider's authorize(). The Credentials
// provider (and its bcrypt/Prisma-backed authorize) lives in auth.ts, which
// is only imported by route handlers and server components (Node runtime).
export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.orgId = (user as { orgId: string }).orgId;
        token.orgSlug = (user as { orgSlug: string }).orgSlug;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.orgId = token.orgId as string;
      session.user.orgSlug = token.orgSlug as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
  trustHost: true,
};
