import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock PrismaClient so we don't need a real DB.
// The mock path must match what vitest resolves after aliases are applied.
// vitest.config.ts aliases '../src/generated/tenant' -> '__stubs__/generated-tenant.ts',
// so we mock the stub path (relative to this file).
vi.mock('./__stubs__/generated-tenant', () => ({
  PrismaClient: vi.fn().mockImplementation((opts: { datasources: { db: { url: string } } }) => ({
    _url: opts.datasources.db.url,
    $disconnect: vi.fn(),
  })),
}));

// Must import after mock
const { getTenantClient, closeTenantClients } = await import('../tenant-client');

describe('getTenantClient', () => {
  beforeEach(async () => {
    await closeTenantClients();
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
  });

  it('appends schema=tenant_<slug> to the DATABASE_URL', () => {
    const client = getTenantClient('acme') as unknown as { _url: string };
    expect(client._url).toContain('schema=tenant_acme');
  });

  it('returns the same client instance on repeated calls', () => {
    const a = getTenantClient('acme');
    const b = getTenantClient('acme');
    expect(a).toBe(b);
  });

  it('returns different instances for different slugs', () => {
    const a = getTenantClient('acme');
    const b = getTenantClient('corp');
    expect(a).not.toBe(b);
  });
});
