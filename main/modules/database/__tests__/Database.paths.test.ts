import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveMainDatabaseFileName,
  resolveMainDatabasePath,
} from "../Database.paths";

describe("Database paths", () => {
  it("uses a separate SQLite file for packaged builds", () => {
    expect(resolveMainDatabaseFileName(false)).toBe("hinekora.sqlite");
    expect(resolveMainDatabaseFileName(true)).toBe("hinekora-prod.sqlite");
  });

  it("resolves the main database path inside userData", () => {
    const userDataPath = join("tmp", "Hinekora");

    expect(resolveMainDatabasePath(userDataPath, true)).toBe(
      join(userDataPath, "hinekora-prod.sqlite"),
    );
  });
});
