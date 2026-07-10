import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const MIGRATION_TABLE = '_TenantMigrations';

interface MigrationRecord {
  migration_name: string;
  applied_at: Date;
}

export interface MigrationFile {
  name: string;
  sql: string;
}

export function getMigrationFiles(migrationsDir: string): MigrationFile[] {
  const entries = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map((dir) => {
    const sqlPath = path.join(migrationsDir, dir.name, 'migration.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Missing migration.sql in ${dir.name}`);
    }
    return { name: dir.name, sql: fs.readFileSync(sqlPath, 'utf-8') };
  });
}

async function ensureMigrationTable(client: Client, schema: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."${MIGRATION_TABLE}" (
      migration_name TEXT NOT NULL PRIMARY KEY,
      applied_at     TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client: Client, schema: string): Promise<Set<string>> {
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

export async function migrateSchema(
  client: Client,
  schema: string,
  migrations: MigrationFile[]
): Promise<void> {
  await ensureMigrationTable(client, schema);
  const applied = await getAppliedMigrations(client, schema);
  const pending = migrations.filter((m) => !applied.has(m.name));
  for (const migration of pending) {
    await applyMigration(client, schema, migration.name, migration.sql);
  }
}
