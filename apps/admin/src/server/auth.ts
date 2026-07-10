import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { publicClient } from '@signflow/db';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await publicClient.user.findUnique({
          where: { email: parsed.data.email },
          include: { org: true },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          orgId: user.orgId,
          orgSlug: user.org.slug,
        };
      },
    }),
  ],
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
});

// Extend next-auth types
declare module 'next-auth' {
  interface User {
    role: string;
    orgId: string;
    orgSlug: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      orgId: string;
      orgSlug: string;
    };
  }
}
