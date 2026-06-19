import { PrismaClient } from '../src/generated/tenant';

declare global {
  // eslint-disable-next-line no-var
  var __tenantClients: Map<string, PrismaClient> | undefined;
}

// Reuse the same Map across hot reloads so old PrismaClients are not orphaned.
// Without globalThis the module re-initialises on each HMR cycle, leaking connections.
const clientCache: Map<string, PrismaClient> =
  globalThis.__tenantClients ?? new Map();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__tenantClients = clientCache;
}

export function getTenantClient(orgSlug: string): PrismaClient {
  const cached = clientCache.get(orgSlug);
  if (cached) return cached;

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL is not set');

  const url = new URL(baseUrl);
  url.searchParams.set('schema', `tenant_${orgSlug}`);
  // Keep the pool small — this client is shared across all requests for this tenant,
  // so 3 connections is plenty and prevents exhausting postgres max_connections.
  url.searchParams.set('connection_limit', '3');
  url.searchParams.set('pool_timeout', '10');

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
