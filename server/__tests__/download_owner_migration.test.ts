import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sqliteMigration = readFileSync(
  resolve(process.cwd(), "migrations/0052_download_owner.sql"),
  "utf8"
);
const postgresMigration = readFileSync(
  resolve(process.cwd(), "migrations-pg/0014_download_owner.sql"),
  "utf8"
);

function migrationStatements(migration: string): string[] {
  return migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("game download owner migrations", () => {
  it("backfills SQLite owner snapshots for existing downloads", () => {
    const db = new Database(":memory:");
    try {
      db.pragma("foreign_keys = ON");
      db.exec(`
        CREATE TABLE users (id text PRIMARY KEY);
        CREATE TABLE games (id text PRIMARY KEY, user_id text);
        CREATE TABLE game_downloads (id text PRIMARY KEY, game_id text NOT NULL, status text NOT NULL);
        INSERT INTO users (id) VALUES ('user-1');
        INSERT INTO games (id, user_id) VALUES ('game-1', 'user-1');
        INSERT INTO game_downloads (id, game_id, status)
          VALUES ('download-1', 'game-1', 'game_link_required');
      `);

      for (const statement of migrationStatements(sqliteMigration)) db.exec(statement);

      const row = db
        .prepare("SELECT owner_user_id FROM game_downloads WHERE id = ?")
        .get("download-1") as { owner_user_id: string };
      expect(row.owner_user_id).toBe("user-1");
      expect(db.prepare("PRAGMA index_list(game_downloads)").all()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "game_downloads_owner_status_idx" }),
        ])
      );
    } finally {
      db.close();
    }
  });

  it("backfills PostgreSQL owner snapshots for existing downloads", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE public.users (id text PRIMARY KEY);
        CREATE TABLE public.games (id text PRIMARY KEY, user_id text);
        CREATE TABLE public.game_downloads (id text PRIMARY KEY, game_id text NOT NULL, status text NOT NULL);
        INSERT INTO public.users (id) VALUES ('user-1');
        INSERT INTO public.games (id, user_id) VALUES ('game-1', 'user-1');
        INSERT INTO public.game_downloads (id, game_id, status)
          VALUES ('download-1', 'game-1', 'game_link_required');
      `);

      for (const statement of migrationStatements(postgresMigration)) await db.exec(statement);

      const result = await db.query<{ owner_user_id: string }>(
        "SELECT owner_user_id FROM public.game_downloads WHERE id = 'download-1'"
      );
      expect(result.rows[0]?.owner_user_id).toBe("user-1");
    } finally {
      await db.close();
    }
  });
});
