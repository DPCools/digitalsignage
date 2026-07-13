import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { publicClient } from '@signflow/db';
import { authConfig } from './auth.config';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
