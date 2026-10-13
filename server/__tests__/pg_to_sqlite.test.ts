import { afterAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as sqliteSchema from "../../shared/schema.js";
import * as pgSchema from "../../shared/schema.pg.js";
import {
  copyAllTables,
  findExistingSqliteRows,
  findPendingPgMigrations,
  readPgMigrationEntries,
} from "../../scripts/pg-to-sqlite.js";

describe("PostgreSQL-to-SQLite migration", () => {
  let pgSource: PGlite;
  let pgDb: ReturnType<typeof drizzlePglite>;
  const addedAt = new Date("2026-01-02T03:04:05.000Z");

  async function createSqliteTarget() {
    const client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    const db = drizzleSqlite(client, { schema: sqliteSchema });
    migrateSqlite(db, { migrationsFolder: "migrations" });
    return { client, db };
  }

  beforeAll(async () => {
    pgSource = new PGlite();
    pgDb = drizzlePglite(pgSource, { schema: pgSchema });
    await migratePglite(pgDb, { migrationsFolder: "migrations-pg" });

    await pgDb.insert(pgSchema.users).values({
      id: "u1",
      username: "alice",
      passwordHash: "hash",
    });
    await pgDb.insert(pgSchema.games).values({
      id: "g1",
      userId: "u1",
      igdbId: 7346,
      title: "Zelda Breath",
      status: "downloaded",
      hidden: true,
      earlyAccess: false,
      platforms: ["Nintendo Switch", "Wii U"],
      genres: ["Adventure"],
      rating: 97.25,
      addedAt,
    });
    await pgDb.insert(pgSchema.downloaders).values({
      id: "dl1",
      name: "qb",
      type: "qbittorrent",
      url: "http://q",
    });
    await pgDb.insert(pgSchema.gameDownloads).values({
      id: "d1",
      gameId: "g1",
      downloaderId: "dl1",
      downloadType: "game",
      downloadHash: "h1",
      downloadTitle: "Zelda.iso",
      status: "completed",
      fileSize: 9_663_676_416,
    });
  }, 60_000);

  afterAll(async () => {
    await pgSource?.close();
  });

  it("recognizes the current PostgreSQL migration journal and reports missing entries", async () => {
    const migrations = readPgMigrationEntries();
    const current = await findPendingPgMigrations(pgSource, migrations);
    expect(current).toEqual({ pending: [], unexpected: [] });

    const future = { tag: "0013_not_applied", when: Date.now() + 1_000, hash: "not-applied" };
    expect(await findPendingPgMigrations(pgSource, [...migrations, future])).toEqual({
      pending: [future.tag],
      unexpected: [],
    });
  });

  it("copies every table and verifies the complete row content across dialects", async () => {
    const { client, db } = await createSqliteTarget();
    try {
      expect(await findExistingSqliteRows(db)).toEqual([]);
      const { counts } = await copyAllTables(pgDb, db, { batchSize: 2 });

      expect(counts.users).toEqual({ postgres: 1, sqlite: 1 });
      expect(counts.games).toEqual({ postgres: 1, sqlite: 1 });
      expect(counts.gameDownloads).toEqual({ postgres: 1, sqlite: 1 });
      expect(counts.notifications).toEqual({ postgres: 0, sqlite: 0 });

      const [game] = db
        .select()
        .from(sqliteSchema.games)
        .where(eq(sqliteSchema.games.id, "g1"))
        .all();
      expect(game.hidden).toBe(true);
      expect(game.earlyAccess).toBe(false);
      expect(game.platforms).toEqual(["Nintendo Switch", "Wii U"]);
      expect(game.genres).toEqual(["Adventure"]);
      expect(game.rating).toBe(97.25);
      expect(game.addedAt).toBeInstanceOf(Date);
      expect(game.addedAt.toISOString()).toBe(addedAt.toISOString());

      const [download] = db
        .select()
        .from(sqliteSchema.gameDownloads)
        .where(eq(sqliteSchema.gameDownloads.id, "d1"))
        .all();
      expect(download.fileSize).toBe(9_663_676_416);
    } finally {
      client.close();
    }
  }, 60_000);

  it("refuses to merge into a non-empty target", async () => {
    const { client, db } = await createSqliteTarget();
    try {
      db.insert(sqliteSchema.users)
        .values({ id: "existing", username: "existing", passwordHash: "hash" })
        .run();
      await expect(copyAllTables(pgDb, db)).rejects.toThrow("SQLite target is not empty");
      expect(db.select().from(sqliteSchema.games).all()).toEqual([]);
    } finally {
      client.close();
    }
  });

  it("rolls back the whole copy if row-content verification fails", async () => {
    const { client, db } = await createSqliteTarget();
    try {
      client.exec(`
        CREATE TRIGGER corrupt_imported_title
        AFTER INSERT ON games
        BEGIN
          UPDATE games SET title = 'corrupted' WHERE id = NEW.id;
        END;
      `);

      await expect(copyAllTables(pgDb, db)).rejects.toThrow(
        "PostgreSQL-to-SQLite content verification failed"
      );
      expect(await findExistingSqliteRows(db)).toEqual([]);
    } finally {
      client.close();
    }
  }, 60_000);
});
