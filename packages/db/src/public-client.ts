import { PrismaClient } from '../src/generated/public';

declare global {
  // eslint-disable-next-line no-var
  var __publicClient: PrismaClient | undefined;
}

export const publicClient: PrismaClient =
  globalThis.__publicClient ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__publicClient = publicClient;
}
