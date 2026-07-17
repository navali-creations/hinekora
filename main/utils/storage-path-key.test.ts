import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createStoragePathKey } from "./storage-path-key";

describe("createStoragePathKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes relative segments", () => {
    expect(createStoragePathKey(join("media", "clips", "..", "A.mp4"))).toBe(
      createStoragePathKey(join("media", "A.mp4")),
    );
  });

  it("folds path casing only on Windows", () => {
    const platform = vi.spyOn(process, "platform", "get");
    const path = join("Media", "A.mp4");

    platform.mockReturnValue("win32");
    expect(createStoragePathKey(path)).toBe(
      createStoragePathKey(path.toLowerCase()),
    );

    platform.mockReturnValue("linux");
    expect(createStoragePathKey(path)).not.toBe(
      createStoragePathKey(path.toLowerCase()),
    );
  });
});
