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

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.join(
  __dirname,
  '../prisma/tenant-migrations'
);

const MIGRATION_TABLE = '_TenantMigrations';

interface MigrationRecord {
  migration_name: string;
  applied_at: Date;
}

async function ensureMigrationTable(client: Client, schema: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."${MIGRATION_TABLE}" (
      migration_name TEXT NOT NULL PRIMARY KEY,
      applied_at     TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(
  client: Client,
  schema: string
): Promise<Set<string>> {
  const result = await client.query<MigrationRecord>(
    `SELECT migration_name FROM "${schema}"."${MIGRATION_TABLE}" ORDER BY migration_name`
  );
  return new Set(result.rows.map((r) => r.migration_name));
}

async function applyMigration(
  client: Client,
  schema: string,
  migrationName: string,
  sql: string
): Promise<void> {
  // Set search_path so unqualified table names resolve to the tenant schema.
  await client.query(`SET search_path TO "${schema}", public`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO "${schema}"."${MIGRATION_TABLE}" (migration_name) VALUES ($1)`,
      [migrationName]
    );
    await client.query('COMMIT');
    console.log(`  [ok] ${migrationName}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function getMigrationFiles(): Promise<Array<{ name: string; sql: string }>> {
  const entries = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map((dir) => {
    const sqlPath = path.join(MIGRATIONS_DIR, dir.name, 'migration.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Missing migration.sql in ${dir.name}`);
    }
    return { name: dir.name, sql: fs.readFileSync(sqlPath, 'utf-8') };
  });
}

async function getTenantSchemaSlugs(client: Client): Promise<string[]> {
  const result = await client.query<{ schema_name: string }>(
    `SELECT schema_name
     FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant_%'
     ORDER BY schema_name`
  );
  return result.rows.map((r) => r.schema_name);
}

async function migrateSchema(
  client: Client,
  schema: string,
  migrations: Array<{ name: string; sql: string }>
): Promise<void> {
  await ensureMigrationTable(client, schema);
  const applied = await getAppliedMigrations(client, schema);

  const pending = migrations.filter((m) => !applied.has(m.name));
  if (pending.length === 0) {
    console.log(`  (no pending migrations)`);
    return;
  }

  for (const migration of pending) {
    await applyMigration(client, schema, migration.name, migration.sql);
  }
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
    const migrations = await getMigrationFiles();
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
