import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HELPER_RESOURCE_DIR,
  WINDOWS_HELPER_EXECUTABLE_NAME,
} from "../PoeProcessHelperPath";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PoE process helper contracts", () => {
  it("keeps runtime lookup, packaging, build copy, and CI assertion helper paths aligned", () => {
    const forgeConfig = readRepoFile("forge.config.ts");
    const buildScript = readRepoFile("scripts/build-poe-process-helper.mjs");
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const packagingAssertion = readRepoFile(
      ".github/scripts/assert-process-helper-packaged.ps1",
    );
    const publishWorkflow = readRepoFile(".github/workflows/publish.yml");
    const packagingAssertionCommand = String.raw`run: .\.github\scripts\assert-process-helper-packaged.ps1`;

    expect(forgeConfig).toContain(HELPER_RESOURCE_DIR);
    expect(buildScript).toContain(HELPER_RESOURCE_DIR);
    expect(buildScript).toContain(WINDOWS_HELPER_EXECUTABLE_NAME);
    expect(packagingAssertion).toContain(HELPER_RESOURCE_DIR);
    expect(packagingAssertion).toContain(WINDOWS_HELPER_EXECUTABLE_NAME);
    expect(ciWorkflow).toContain(packagingAssertionCommand);
    expect(ciWorkflow).toContain(
      "contains(github.event.head_commit.message, '[ci] release')",
    );
    expect(ciWorkflow).toContain("always() &&");
    expect(publishWorkflow).toContain(packagingAssertionCommand);
  });
});
