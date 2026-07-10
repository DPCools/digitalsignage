/**
 * apply-tenant-migrations.ts
 *
 * Applies pending SQL migrations from prisma/tenant-migrations/ to one or more
 * tenant schemas. Tenant schemas are identified by the `tenant_<slug>` naming
 * convention in the PostgreSQL database.
 *
 * Usage:
 *   # Apply to all tenant schemas:
 *   pnpm db:migrate:tenant
 *
 *   # Apply to a specific tenant slug:
 *   pnpm db:migrate:tenant -- --slug acme
 *
 * Migrations are tracked in a "_TenantMigrations" table within each tenant
 * schema and are applied in filename order, idempotently.
 */

import path from 'path';
import { Client } from 'pg';
import { getMigrationFiles, migrateSchema } from './tenant-migrations-core';

const MIGRATIONS_DIR = path.join(
  __dirname,
  '../prisma/tenant-migrations'
);

async function getTenantSchemaSlugs(client: Client): Promise<string[]> {
  const result = await client.query<{ schema_name: string }>(
    `SELECT schema_name
     FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant_%'
     ORDER BY schema_name`
  );
  return result.rows.map((r) => r.schema_name);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Parse optional --slug argument
  const slugArg = process.argv.indexOf('--slug');
  const targetSlug = slugArg !== -1 ? process.argv[slugArg + 1] : null;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const migrations = getMigrationFiles(MIGRATIONS_DIR);
    console.log(`Found ${migrations.length} migration(s): ${migrations.map((m) => m.name).join(', ')}`);

    let schemas: string[];
    if (targetSlug) {
      schemas = [`tenant_${targetSlug}`];
    } else {
      schemas = await getTenantSchemaSlugs(client);
      console.log(`Found ${schemas.length} tenant schema(s): ${schemas.join(', ')}`);
    }

    for (const schema of schemas) {
      console.log(`\nMigrating schema: ${schema}`);
      await migrateSchema(client, schema, migrations);
    }

    console.log('\nAll tenant migrations complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
