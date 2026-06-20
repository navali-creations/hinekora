import type { DatabaseSync, SQLInputValue, StatementSync } from "node:sqlite";

import type { SqliteDatabase, SqliteStatement } from "kysely";

class NodeSqliteKyselyStatement implements SqliteStatement {
  readonly reader: boolean;

  constructor(private readonly statement: StatementSync) {
    this.reader = statement.columns().length > 0;
  }

  all(parameters: ReadonlyArray<unknown>): unknown[] {
    return this.statement.all(...this.toSqlInputValues(parameters));
  }

  run(parameters: ReadonlyArray<unknown>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  } {
    return this.statement.run(...this.toSqlInputValues(parameters));
  }

  *iterate(parameters: ReadonlyArray<unknown>): IterableIterator<unknown> {
    for (const row of this.statement.iterate(
      ...this.toSqlInputValues(parameters),
    )) {
      yield row;
    }
  }

  private toSqlInputValues(
    parameters: ReadonlyArray<unknown>,
  ): SQLInputValue[] {
    return parameters as SQLInputValue[];
  }
}

class NodeSqliteKyselyDatabase implements SqliteDatabase {
  constructor(private readonly database: DatabaseSync) {}

  close(): void {
    // DatabaseService owns the node:sqlite connection lifecycle.
  }

  prepare(sql: string): SqliteStatement {
    return new NodeSqliteKyselyStatement(this.database.prepare(sql));
  }
}

export { NodeSqliteKyselyDatabase };
