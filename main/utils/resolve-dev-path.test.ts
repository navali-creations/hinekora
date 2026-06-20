import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveDevFile } from "./resolve-dev-path";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hinekora-dev-path-"));
});

afterEach(() => {
  rmSync(directory, { force: true, recursive: true });
});

describe("resolveDevFile", () => {
  it("returns direct files when they exist", () => {
    writeFileSync(join(directory, "CHANGELOG.md"), "# Changelog");

    expect(resolveDevFile(directory, "CHANGELOG.md")).toBe(
      join(directory, "CHANGELOG.md"),
    );
  });

  it("walks parent directories and falls back to the direct path", () => {
    const child = join(directory, "a", "b");
    mkdirSync(child, { recursive: true });
    writeFileSync(join(directory, "README.md"), "# Hinekora");

    expect(resolveDevFile(child, "README.md")).toBe(
      join(directory, "README.md"),
    );
    expect(resolveDevFile(child, "missing.md")).toBe(join(child, "missing.md"));
  });
});
