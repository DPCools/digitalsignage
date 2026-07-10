import path from 'path';
import { Client } from 'pg';
import type { PrismaClient } from '../src/generated/public';
import { getMigrationFiles, migrateSchema } from './tenant-migrations-core';

// Resolves the SQL migration files the same way apply-tenant-migrations.ts
// does. In production the admin app runs from a Next.js standalone bundle,
// where __dirname no longer points at this file's real source directory, so
// the Dockerfile copies prisma/tenant-migrations to a fixed path and sets
// TENANT_MIGRATIONS_DIR to match. Falling back to __dirname keeps this
// working unbundled (local dev, tsx-run scripts).
function resolveMigrationsDir(): string {
  return process.env.TENANT_MIGRATIONS_DIR ?? path.join(__dirname, '../prisma/tenant-migrations');
}

export async function provisionTenantSchema(
  orgSlug: string,
  db: PrismaClient
): Promise<void> {
  const schemaName = `tenant_${orgSlug}`;

  // 1. Create the PostgreSQL schema
  await db.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
  );

  // 2. Apply the same SQL migrations used by `pnpm db:migrate:tenant` — not
  // `prisma db push`, which needs the Prisma CLI + schema file present at
  // runtime and isn't available in the production standalone image.
  const migrations = getMigrationFiles(resolveMigrationsDir());

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await migrateSchema(client, schemaName, migrations);
  } finally {
    await client.end();
  }
}
