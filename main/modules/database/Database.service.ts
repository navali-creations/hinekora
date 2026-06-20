import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import {
  type Compilable,
  type CompiledQuery,
  isCompilable,
  Kysely,
  SqliteDialect,
} from "kysely";

import type { DatabaseSchema } from "./Database.types";
import { MigrationRunner, migrations } from "./migrations";
import { NodeSqliteKyselyDatabase } from "./NodeSqliteKysely.adapter";

type DatabaseQuery<TResult> = Compilable<TResult> | CompiledQuery<TResult>;

const isVitestRuntime =
  process.env.VITEST === "true" || process.env.NODE_ENV === "test";

function resolveDefaultDatabasePath(): string {
  if (isVitestRuntime) {
    return ":memory:";
  }

  return join(process.cwd(), "hinekora.sqlite");
}

class DatabaseService {
  private static instance: DatabaseService | null = null;

  private readonly database: DatabaseSync;
  private readonly queryBuilder: Kysely<DatabaseSchema>;
  private readonly migrationRunner: MigrationRunner;
  private readonly databasePath: string;
  private transactionDepth = 0;
  private isClosed = false;

  static getInstance(databasePath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(databasePath);
    }

    return DatabaseService.instance;
  }

  static resetForTests(): void {
    DatabaseService.instance?.close();
    DatabaseService.instance = null;
  }

  constructor(databasePath?: string) {
    this.databasePath = databasePath ?? resolveDefaultDatabasePath();

    if (this.databasePath !== ":memory:") {
      mkdirSync(dirname(this.databasePath), { recursive: true });
    }

    this.database = new DatabaseSync(this.databasePath);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.queryBuilder = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new NodeSqliteKyselyDatabase(this.database),
      }),
    });
    this.migrationRunner = new MigrationRunner(this.database);
    this.migrationRunner.runMigrations(migrations);
  }

  get path(): string {
    return this.databasePath;
  }

  get db(): DatabaseSync {
    this.assertOpen();
    return this.database;
  }

  get kysely(): Kysely<DatabaseSchema> {
    this.assertOpen();
    return this.queryBuilder;
  }

  get migrations(): MigrationRunner {
    this.assertOpen();
    return this.migrationRunner;
  }

  backupToFile(backupPath: string): void {
    this.assertOpen();

    if (this.databasePath === ":memory:") {
      throw new Error("In-memory databases cannot be backed up to disk");
    }

    mkdirSync(dirname(backupPath), { recursive: true });
    this.database.prepare("VACUUM INTO ?").run(backupPath);
  }

  queryAll<TResult>(query: DatabaseQuery<TResult>): TResult[] {
    this.assertOpen();

    const compiledQuery = this.compileQuery(query);
    return this.database
      .prepare(compiledQuery.sql)
      .all(
        ...this.toSqlInputValues(compiledQuery.parameters),
      ) as unknown as TResult[];
  }

  queryOne<TResult>(query: DatabaseQuery<TResult>): TResult | undefined {
    this.assertOpen();

    const compiledQuery = this.compileQuery(query);
    return this.database
      .prepare(compiledQuery.sql)
      .get(...this.toSqlInputValues(compiledQuery.parameters)) as unknown as
      | TResult
      | undefined;
  }

  runQuery<TResult>(query: DatabaseQuery<TResult>): void {
    this.assertOpen();

    const compiledQuery = this.compileQuery(query);
    this.database
      .prepare(compiledQuery.sql)
      .run(...this.toSqlInputValues(compiledQuery.parameters));
  }

  transaction<T>(work: () => T): T {
    this.assertOpen();

    if (this.transactionDepth > 0) {
      return work();
    }

    this.transactionDepth += 1;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  close(): void {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    void this.queryBuilder.destroy();
    this.database.close();
  }

  private assertOpen(): void {
    if (this.isClosed) {
      throw new Error(
        "[Database] Cannot access database - connection is closed",
      );
    }
  }

  private compileQuery<TResult>(
    query: DatabaseQuery<TResult>,
  ): CompiledQuery<TResult> {
    return isCompilable(query) ? query.compile() : query;
  }

  private toSqlInputValues(
    parameters: ReadonlyArray<unknown>,
  ): SQLInputValue[] {
    return parameters as SQLInputValue[];
  }
}

export { DatabaseService };
