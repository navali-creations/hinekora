import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { CompiledQuery } from "kysely";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../Database.service";
import { migrations } from "../migrations";

describe("DatabaseService", () => {
  afterEach(() => {
    DatabaseService.resetForTests();
  });

  it("uses an in-memory default database during tests", () => {
    const database = new DatabaseService();

    expect(database.path).toBe(":memory:");

    database.close();
  });

  it("uses the current working directory for the production default database", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-database-default-"));
    const previousCwd = process.cwd();
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVitest = process.env.VITEST;

    try {
      vi.resetModules();
      process.chdir(directory);
      process.env.NODE_ENV = "production";
      process.env.VITEST = "false";
      const { DatabaseService: ProductionDatabaseService } = await import(
        "../Database.service"
      );
      const database = new ProductionDatabaseService();

      expect(database.path).toBe(join(directory, "hinekora.sqlite"));
      database.close();
      ProductionDatabaseService.resetForTests();
    } finally {
      process.chdir(previousCwd);
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousVitest === undefined) {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = previousVitest;
      }
      vi.resetModules();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates the initial schema idempotently", () => {
    const database = new DatabaseService(":memory:");
    const appliedMigrationIds = database.migrations.getAppliedMigrationIds();

    expect(appliedMigrationIds).toEqual(
      migrations.map((migration) => migration.id),
    );

    database.close();
  });

  it("exposes a typed Kysely query builder for the same connection", async () => {
    const database = new DatabaseService(":memory:");

    await database.kysely
      .insertInto("settings")
      .values({
        key: "selectedGame",
        value_json: JSON.stringify("poe2"),
        updated_at: new Date().toISOString(),
      })
      .execute();

    const row = await database.kysely
      .selectFrom("settings")
      .select(["key", "value_json"])
      .where("key", "=", "selectedGame")
      .executeTakeFirstOrThrow();

    expect(row).toEqual({
      key: "selectedGame",
      value_json: JSON.stringify("poe2"),
    });

    database.close();
  });

  it("exposes the raw SQLite connection for low-level operations", () => {
    const database = new DatabaseService(":memory:");

    expect(database.db.prepare("SELECT 1 AS value").get()).toEqual({
      value: 1,
    });

    database.close();
  });

  it("accepts precompiled query objects", () => {
    const database = new DatabaseService(":memory:");
    const query = CompiledQuery.raw("SELECT 1 AS value");

    expect(database.queryOne(query)).toEqual({ value: 1 });

    database.close();
  });

  it("rejects disk backup for in-memory databases", () => {
    const database = new DatabaseService(":memory:");

    expect(() =>
      database.backupToFile(join(tmpdir(), "backup.sqlite")),
    ).toThrow("In-memory databases cannot be backed up to disk");

    database.close();
  });

  it("treats close as idempotent and rejects later access", () => {
    const database = new DatabaseService(":memory:");

    database.close();
    database.close();

    expect(() => database.db).toThrow(
      "[Database] Cannot access database - connection is closed",
    );
  });

  it("creates a SQLite-consistent disk backup while WAL mode is active", () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-database-backup-"));
    const databasePath = join(directory, "hinekora.sqlite");
    const backupPath = join(directory, "hinekora-backup.sqlite");
    const database = new DatabaseService(databasePath);

    try {
      database.runQuery(
        database.kysely.insertInto("settings").values({
          key: "activeGame",
          value_json: JSON.stringify("poe2"),
          updated_at: new Date().toISOString(),
        }),
      );
      database.backupToFile(backupPath);

      expect(existsSync(backupPath)).toBe(true);

      const backup = new DatabaseSync(backupPath, { readOnly: true });
      try {
        expect(
          backup
            .prepare("SELECT value_json FROM settings WHERE key = ?")
            .get("activeGame"),
        ).toEqual({ value_json: JSON.stringify("poe2") });
      } finally {
        backup.close();
      }
    } finally {
      database.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
