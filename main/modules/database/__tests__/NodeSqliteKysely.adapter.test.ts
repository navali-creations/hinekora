import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { NodeSqliteKyselyDatabase } from "../NodeSqliteKysely.adapter";

describe("NodeSqliteKyselyDatabase", () => {
  it("adapts node:sqlite statements to Kysely's sqlite driver shape", () => {
    const sqlite = new DatabaseSync(":memory:");
    const database = new NodeSqliteKyselyDatabase(sqlite);

    try {
      database
        .prepare("CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT)")
        .run([]);
      const insert = database.prepare(
        "INSERT INTO test_items (name) VALUES (?)",
      );
      expect(insert.reader).toBe(false);
      expect(insert.run(["one"]).changes).toBe(1);

      const select = database.prepare(
        "SELECT name FROM test_items WHERE id = ?",
      );
      expect(select.reader).toBe(true);
      expect(select.all([1])).toEqual([{ name: "one" }]);
      expect([...select.iterate([1])]).toEqual([{ name: "one" }]);
      expect(database.close()).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
