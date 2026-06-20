import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { AppSettings } from "~/types";
import { createSettingsSlice } from "./Settings.slice";

const settings = {
  activeGame: "poe2",
  activeLeague: "Standard",
  installedGames: ["poe2"],
  lastSeenAppVersion: null,
} as unknown as AppSettings;

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createSettingsSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("Settings slice", () => {
  const getSettings = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue(settings);
    updateSettings.mockResolvedValue({ ...settings, activeLeague: "Hardcore" });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        settings: {
          get: getSettings,
          update: updateSettings,
        },
      },
    });
  });

  it("hydrates and updates settings", async () => {
    const store = createTestStore();

    await store.getState().settings.hydrate();
    await store.getState().settings.update({ activeLeague: "Hardcore" });

    expect(getSettings).toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith({ activeLeague: "Hardcore" });
    expect(store.getState().settings.value?.activeLeague).toBe("Hardcore");
  });
});
