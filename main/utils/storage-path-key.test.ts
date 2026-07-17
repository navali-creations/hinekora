import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createStoragePathKey } from "./storage-path-key";

describe("createStoragePathKey", () => {
  it("normalizes relative segments and Windows path casing", () => {
    expect(
      createStoragePathKey(join("C:\\Media", "clips", "..", "A.mp4")),
    ).toBe(createStoragePathKey("c:\\media\\a.mp4"));
  });
});
