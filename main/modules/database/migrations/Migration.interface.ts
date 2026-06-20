import type { DatabaseSync } from "node:sqlite";

interface Migration {
  readonly id: string;
  readonly description: string;
  up(db: DatabaseSync): void;
  down(db: DatabaseSync): void;
}

export type { Migration };
