/**
 * Copy the current Questarr PostgreSQL backend into a migrated SQLite database.
 *
 * Usage:
 *   DB_DIALECT=postgres DATABASE_URL=postgres://... npm run db:migrate
 *   SQLITE_DB_PATH=./data/sqlite.db npm run db:migrate
 *   DATABASE_URL=postgres://... SQLITE_DB_PATH=./data/sqlite.db \
 *     npm run db:copy:pg-to-sqlite
 *
 * The Postgres source is held in a repeatable-read, read-only transaction. The
 * SQLite target must already have the current schema and contain no app data.
 * All copied rows are inserted and verified in one SQLite transaction, so any
 * error or content mismatch leaves the target empty.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import pg from "pg";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as sqliteSchema from "../shared/schema.js";
import * as pgSchema from "../shared/schema.pg.js";
import { TABLE_ORDER } from "./sqlite-to-pg.js";
import {
  describePendingSqliteMigrations,
  findPendingSqliteMigrations,
  readSqliteJournalTags,
} from "./sqlite-to-pg.js";

type TableName = (typeof TABLE_ORDER)[number];

interface JournalEntry {
  tag: string;
  when: number;
}

export interface PgMigration {
  tag: string;
  when: number;
  hash: string;
}

export interface PgMigrationStatus {
  pending: string[];
  unexpected: string[];
}

interface PgJournal {
  entries: JournalEntry[];
}

interface PgMigrationRecord {
  hash: string;
  created_at: string | number;
}

interface PgQueryable {
  query(query: string): Promise<{ rows: PgMigrationRecord[] }>;
}

interface ExistingTableRows {
  table: string;
  rows: number;
}

export interface CopyResult {
  counts: Record<string, { postgres: number; sqlite: number }>;
}

/**
 * Drizzle's table generics differ between dialect schemas. This script indexes
 * both parity-checked schemas from one table-order list, so the migration loop
 * crosses those generics in one deliberately dynamic boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicDatabase = any;

/** Read and hash the PostgreSQL migrations used by the current application. */
export function readPgMigrationEntries(
  journalPath = path.resolve(process.cwd(), "migrations-pg", "meta", "_journal.json")
): PgMigration[] {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as PgJournal;
  const migrationsDirectory = path.dirname(path.dirname(journalPath));
  return journal.entries.map(({ tag, when }) => {
    const contents = fs.readFileSync(path.join(migrationsDirectory, `${tag}.sql`), "utf-8");
    return {
      tag,
      when,
      hash: crypto.createHash("sha256").update(contents).digest("hex"),
    };
  });
}

/**
 * Detect missing or unknown PostgreSQL migration records. Drizzle records the
 * SHA-256 of each SQL file and its journal timestamp in drizzle.__drizzle_migrations.
 */
export async function findPendingPgMigrations(
  source: PgQueryable,
  expected: PgMigration[]
): Promise<PgMigrationStatus> {
  let records: PgMigrationRecord[];
  try {
    ({ rows: records } = await source.query(
      'SELECT hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at'
    ));
  } catch (error) {
    if ((error as { code?: string }).code !== "42P01") throw error;
    return { pending: expected.map((migration) => migration.tag), unexpected: [] };
  }

  const key = (hash: string, when: string | number) => `${hash}:${String(when)}`;
  const expectedKeys = new Set(expected.map((migration) => key(migration.hash, migration.when)));
  const appliedKeys = new Set(records.map((record) => key(record.hash, record.created_at)));
  const pending = expected
    .filter((migration) => !appliedKeys.has(key(migration.hash, migration.when)))
    .map((migration) => migration.tag);

  const seen = new Set<string>();
  const unexpected = records.flatMap((record) => {
    const recordKey = key(record.hash, record.created_at);
    const duplicate = seen.has(recordKey);
    seen.add(recordKey);
    return !expectedKeys.has(recordKey) || duplicate
      ? [`${record.hash}:${String(record.created_at)}${duplicate ? " (duplicate)" : ""}`]
      : [];
  });

  return { pending, unexpected };
}

export function describePendingPgMigrations(status: PgMigrationStatus): string | null {
  if (status.pending.length === 0 && status.unexpected.length === 0) return null;
  const details: string[] = [];
  if (status.pending.length > 0) {
    details.push(
      `The PostgreSQL database is missing ${status.pending.length} current migration(s), starting with ${status.pending[0]}.`
    );
  }
  if (status.unexpected.length > 0) {
    details.push(
      `The PostgreSQL database has ${status.unexpected.length} migration record(s) not present in this source tree.`
    );
  }
  details.push(
    "Start this Questarr version with DB_DIALECT=postgres so it can apply its migrations, stop it, then re-run this script."
  );
  return details.join("\n");
}

/** Non-empty SQLite application tables are never merged into. */
export async function findExistingSqliteRows(dst: DynamicDatabase): Promise<ExistingTableRows[]> {
  const existing: ExistingTableRows[] = [];
  for (const name of TABLE_ORDER) {
    const [row] = await dst
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(sqliteSchema[name as TableName]);
    if (row.n > 0) existing.push({ table: name, rows: row.n });
  }
  return existing;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (typeof value === "bigint") return { $bigint: value.toString() };
  if (Buffer.isBuffer(value)) return { $bytes: value.toString("hex") };
  if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("hex") };
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, normalizeValue(record[key])])
    );
  }
  return value;
}

/** Hash row values after normalizing object key order and dialect-neutral dates. */
export function hashRows(rows: Array<Record<string, unknown>>): string {
  const serialized = rows.map((row) => JSON.stringify(normalizeValue(row))).sort();
  return crypto.createHash("sha256").update(serialized.join("\n")).digest("hex");
}

/**
 * Copy every supported table from PostgreSQL to SQLite. A single SQLite
 * transaction covers insertion and content verification; any failure rolls
 * back all rows instead of leaving a partial destination.
 */
export async function copyAllTables(
  src: DynamicDatabase,
  dst: DynamicDatabase,
  options: { batchSize?: number } = {}
): Promise<CopyResult> {
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`batchSize must be a positive integer, got: ${batchSize}`);
  }

  const existing = await findExistingSqliteRows(dst);
  if (existing.length > 0) {
    const details = existing.map((table) => `${table.table} (${table.rows})`).join(", ");
    throw new Error(`SQLite target is not empty: ${details}. Refusing to merge databases.`);
  }

  const sourceRows = new Map<TableName, Array<Record<string, unknown>>>();
  for (const name of TABLE_ORDER) {
    sourceRows.set(
      name,
      (await src.select().from(pgSchema[name])) as Array<Record<string, unknown>>
    );
  }

  return dst.transaction((tx: DynamicDatabase) => {
    const counts: CopyResult["counts"] = {};
    const mismatched: string[] = [];

    for (const name of TABLE_ORDER) {
      const rows = sourceRows.get(name)!;
      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        tx.insert(sqliteSchema[name]).values(batch).run();
      }

      const targetRows = tx.select().from(sqliteSchema[name]).all() as Array<
        Record<string, unknown>
      >;
      counts[name] = { postgres: rows.length, sqlite: targetRows.length };
      if (rows.length !== targetRows.length || hashRows(rows) !== hashRows(targetRows)) {
        mismatched.push(name);
      }
    }

    if (mismatched.length > 0) {
      throw new Error(
        `PostgreSQL-to-SQLite content verification failed for: ${mismatched.join(", ")}.`
      );
    }
    return { counts };
  });
}

function parseBatchSize(args: string[]): number {
  const argument = args.find((value) => value.startsWith("--batch-size="));
  return argument ? Number(argument.split("=")[1]) : 100;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const sqlitePathValue = process.env.SQLITE_DB_PATH;
  const batchSize = parseBatchSize(process.argv.slice(2));

  if (!databaseUrl || !sqlitePathValue) {
    throw new Error("Set both DATABASE_URL and SQLITE_DB_PATH before running this migration.");
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`--batch-size must be a positive integer, got: ${batchSize}`);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid Postgres connection URL.");
  }
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres: or postgresql: protocol.");
  }

  const sqlitePath = path.resolve(sqlitePathValue);
  if (!fs.existsSync(sqlitePath) || !fs.statSync(sqlitePath).isFile()) {
    throw new Error(
      `SQLite target ${sqlitePath} does not exist. Initialize it first with SQLITE_DB_PATH=${sqlitePathValue} npm run db:migrate.`
    );
  }

  const sqliteClient = new Database(sqlitePath, { fileMustExist: true });
  sqliteClient.pragma("foreign_keys = ON");
  const sqliteDb = drizzleSqlite(sqliteClient, { schema: sqliteSchema });
  const pendingSqlite = describePendingSqliteMigrations(
    findPendingSqliteMigrations(sqliteClient, readSqliteJournalTags())
  );
  if (pendingSqlite) {
    sqliteClient.close();
    throw new Error(`${pendingSqlite}\nThe SQLite target was not modified.`);
  }

  const pgMigrations = readPgMigrationEntries();
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  let client: pg.PoolClient | undefined;
  let transactionOpen = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;

    const pgStatus = await findPendingPgMigrations(client, pgMigrations);
    const pendingPg = describePendingPgMigrations(pgStatus);
    if (pendingPg) throw new Error(`${pendingPg}\nThe SQLite target was not modified.`);

    const pgDb = drizzlePg(client, { schema: pgSchema });
    const { counts } = await copyAllTables(pgDb, sqliteDb, { batchSize });
    console.log(
      "PostgreSQL source remained read-only. Content verified inside one SQLite transaction:"
    );
    for (const name of TABLE_ORDER) {
      const count = counts[name]!;
      console.log(`  ${name.padEnd(24)} postgres=${count.postgres} sqlite=${count.sqlite}`);
    }
    console.log("\nMigration complete. Start Questarr with the default SQLite backend.");
  } finally {
    if (transactionOpen && client) await client.query("ROLLBACK").catch(() => undefined);
    client?.release();
    await pool.end();
    sqliteClient.close();
  }
}

function safeError(error: unknown, databaseUrl: string | undefined): string {
  const message = error instanceof Error ? error.message : String(error);
  let safeMessage = databaseUrl
    ? message.replaceAll(databaseUrl, "[redacted PostgreSQL URL]")
    : message;
  safeMessage = safeMessage.replace(
    /(?:postgres|postgresql):\/\/[^\s'"<>]+/gi,
    "[redacted PostgreSQL URL]"
  );
  return safeMessage;
}

if (process.argv[1]?.includes("pg-to-sqlite")) {
  main().catch((error: unknown) => {
    console.error(
      `PostgreSQL-to-SQLite migration failed: ${safeError(error, process.env.DATABASE_URL)}`
    );
    process.exitCode = 1;
  });
}
