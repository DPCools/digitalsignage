import { execFileSync } from 'child_process';
import path from 'path';
import type { PrismaClient } from '../src/generated/public';

export async function provisionTenantSchema(
  orgSlug: string,
  db: PrismaClient
): Promise<void> {
  const schemaName = `tenant_${orgSlug}`;

  // 1. Create the PostgreSQL schema
  await db.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
  );

  // 2. Push Prisma tenant schema to the new PostgreSQL schema.
  const tenantUrl = new URL(process.env.DATABASE_URL!);
  tenantUrl.searchParams.set('schema', schemaName);

  execFileSync(
    'npx',
    [
      'prisma',
      'db',
      'push',
      '--skip-generate',
      '--accept-data-loss',
      '--schema',
      path.join(__dirname, '../prisma/tenant.prisma'),
    ],
    {
      env: { ...process.env, TENANT_DATABASE_URL: tenantUrl.toString() },
      stdio: 'pipe',
    }
  );
}
