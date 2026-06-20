import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createChangelogSlice } from "./Changelog.slice";

const release: ChangelogRelease = {
  changeType: "Patch Changes",
  entries: [{ description: "Fixed export" }],
  version: "0.1.0",
};

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createChangelogSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("Changelog slice", () => {
  const getChangelog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getChangelog.mockResolvedValue({
      success: true,
      releases: [release],
    });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        updater: {
          getChangelog,
        },
      },
    });
  });

  it("fetches changelog releases and skips a cached fetch", async () => {
    const store = createTestStore();

    await store.getState().changelog.fetchChangelog();
    await store.getState().changelog.fetchChangelog();

    expect(getChangelog).toHaveBeenCalledTimes(1);
    expect(store.getState().changelog).toMatchObject({
      error: null,
      hasFetched: true,
      isLoading: false,
      releases: [release],
    });
  });

  it("stores API and thrown errors", async () => {
    const store = createTestStore();

    getChangelog.mockResolvedValueOnce({
      success: false,
      releases: [],
    });
    await store.getState().changelog.fetchChangelog();
    expect(store.getState().changelog.error).toBe("Failed to load changelog");

    store.getState().changelog.reset();
    getChangelog.mockRejectedValueOnce(new Error("offline"));
    await store.getState().changelog.fetchChangelog();
    expect(store.getState().changelog.error).toBe("offline");

    store.getState().changelog.reset();
    getChangelog.mockRejectedValueOnce("offline");
    await store.getState().changelog.fetchChangelog();
    expect(store.getState().changelog.error).toBe("Load failed");
  });

  it("resets changelog state", async () => {
    const store = createTestStore();

    await store.getState().changelog.fetchChangelog();
    store.getState().changelog.reset();

    expect(store.getState().changelog).toMatchObject({
      error: null,
      hasFetched: false,
      isLoading: false,
      releases: [],
    });
  });
});
