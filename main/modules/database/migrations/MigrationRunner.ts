import type { DatabaseSync } from "node:sqlite";

import type { Migration } from "./Migration.interface";

interface MigrationRecord {
  id: string;
  description: string;
  applied_at: string;
}

class MigrationRunner {
  constructor(private readonly db: DatabaseSync) {
    this.ensureMigrationsTable();
  }

  runMigrations(migrations: readonly Migration[]): void {
    this.assertUniqueMigrationIds(migrations);

    const appliedMigrations = this.getAppliedMigrationIdSet();
    const pendingMigrations = migrations.filter(
      (migration) => !appliedMigrations.has(migration.id),
    );

    if (pendingMigrations.length === 0) {
      return;
    }

    this.runInTransaction(() => {
      for (const migration of pendingMigrations) {
        migration.up(this.db);
        this.recordMigration(migration);
      }
    });
  }

  rollbackMigration(migration: Migration): boolean {
    if (!this.isMigrationApplied(migration.id)) {
      return false;
    }

    this.runInTransaction(() => {
      migration.down(this.db);
      this.removeMigrationRecord(migration.id);
    });

    return true;
  }

  listAppliedMigrations(): string[] {
    return this.getAppliedMigrationRecords().map(
      (migration) =>
        `${migration.id} - ${migration.description} (${migration.applied_at})`,
    );
  }

  getAppliedMigrationIds(): string[] {
    return this.getAppliedMigrationRecords().map((migration) => migration.id);
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  private getAppliedMigrationIdSet(): Set<string> {
    return new Set(this.getAppliedMigrationIds());
  }

  private getAppliedMigrationRecords(): MigrationRecord[] {
    return this.db
      .prepare(
        "SELECT id, description, applied_at FROM migrations ORDER BY id ASC",
      )
      .all() as unknown as MigrationRecord[];
  }

  private isMigrationApplied(migrationId: string): boolean {
    const result = this.db
      .prepare("SELECT 1 AS applied FROM migrations WHERE id = ?")
      .get(migrationId) as { applied: number } | undefined;

    return result !== undefined;
  }

  private recordMigration(migration: Migration, appliedAt?: string): void {
    this.db
      .prepare(
        `
        INSERT OR IGNORE INTO migrations (id, description, applied_at)
        VALUES (?, ?, ?)
      `,
      )
      .run(
        migration.id,
        migration.description,
        appliedAt ?? new Date().toISOString(),
      );
  }

  private removeMigrationRecord(migrationId: string): void {
    this.db.prepare("DELETE FROM migrations WHERE id = ?").run(migrationId);
  }

  private assertUniqueMigrationIds(migrations: readonly Migration[]): void {
    const seen = new Set<string>();

    for (const migration of migrations) {
      if (seen.has(migration.id)) {
        throw new Error(`[Migrations] Duplicate migration id: ${migration.id}`);
      }

      seen.add(migration.id);
    }
  }

  private runInTransaction(work: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      work();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export { MigrationRunner };
