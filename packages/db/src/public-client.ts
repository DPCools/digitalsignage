import { PrismaClient } from '../src/generated/public';

declare global {
  // eslint-disable-next-line no-var
  var __publicClient: PrismaClient | undefined;
}

function makePublicClient(): PrismaClient {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return new PrismaClient();
  const url = new URL(baseUrl);
  url.searchParams.set('connection_limit', '3');
  url.searchParams.set('pool_timeout', '10');
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}

export const publicClient: PrismaClient =
  globalThis.__publicClient ?? makePublicClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__publicClient = publicClient;
}
