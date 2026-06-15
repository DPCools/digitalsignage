import { PrismaClient } from '../src/generated/tenant';

const clientCache = new Map<string, PrismaClient>();

export function getTenantClient(orgSlug: string): PrismaClient {
  const cached = clientCache.get(orgSlug);
  if (cached) return cached;

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL is not set');

  const url = new URL(baseUrl);
  url.searchParams.set('schema', `tenant_${orgSlug}`);

  const client = new PrismaClient({
    datasources: { db: { url: url.toString() } },
  });

  clientCache.set(orgSlug, client);
  return client;
}

export async function closeTenantClients(): Promise<void> {
  await Promise.all([...clientCache.values()].map((c) => c.$disconnect()));
  clientCache.clear();
}
