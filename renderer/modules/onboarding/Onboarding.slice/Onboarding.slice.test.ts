import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createDefaultSettings } from "~/types";
import { allOnboardingBeaconIds } from "../onboarding-config/onboarding-labels";
import { createOnboardingSlice } from "./Onboarding.slice";

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createOnboardingSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("Onboarding slice", () => {
  const getSettings = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({
      ...createDefaultSettings(),
      onboardingDismissedBeacons: ["game-selector"],
    });
    updateSettings.mockResolvedValue(createDefaultSettings());

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

  it("hydrates dismissed beacons from settings", async () => {
    const store = createTestStore();

    await store.getState().onboarding.hydrate();

    expect(getSettings).toHaveBeenCalled();
    expect(store.getState().onboarding.dismissedBeacons).toEqual([
      "game-selector",
    ]);
    expect(store.getState().onboarding.isDismissed("game-selector")).toBe(true);
  });

  it("normalizes unknown and duplicate dismissed beacons on hydrate", async () => {
    getSettings.mockResolvedValue({
      ...createDefaultSettings(),
      onboardingDismissedBeacons: [
        "game-selector",
        "unknown-beacon",
        "game-selector",
        "editor-timeline",
      ],
    });
    const store = createTestStore();

    await store.getState().onboarding.hydrate();

    expect(store.getState().onboarding.dismissedBeacons).toEqual([
      "game-selector",
      "editor-timeline",
    ]);
    expect(updateSettings).toHaveBeenCalledWith({
      onboardingDismissedBeacons: ["game-selector", "editor-timeline"],
    });
  });

  it("dismisses, resets, and refreshes beacon state", async () => {
    const store = createTestStore();

    await store.getState().onboarding.hydrate();
    await store.getState().onboarding.dismiss("overlay-icon");

    expect(updateSettings).toHaveBeenLastCalledWith({
      onboardingDismissedBeacons: ["game-selector", "overlay-icon"],
    });
    expect(store.getState().onboarding.isDismissed("overlay-icon")).toBe(true);

    await store.getState().onboarding.reset("game-selector");

    expect(updateSettings).toHaveBeenLastCalledWith({
      onboardingDismissedBeacons: ["overlay-icon"],
    });
    expect(store.getState().onboarding.isDismissed("game-selector")).toBe(
      false,
    );

    store.getState().onboarding.refreshBeaconHost();
    expect(store.getState().onboarding.beaconHostRefreshKey).toBe(1);
  });

  it("dismisses and resets the whole tour", async () => {
    const store = createTestStore();

    await store.getState().onboarding.dismissAll();
    expect(updateSettings).toHaveBeenLastCalledWith({
      onboardingDismissedBeacons: allOnboardingBeaconIds,
    });

    await store.getState().onboarding.resetAll();
    expect(updateSettings).toHaveBeenLastCalledWith({
      onboardingDismissedBeacons: [],
    });
  });

  it("ignores dismiss requests for unknown beacons", async () => {
    const store = createTestStore();

    await store.getState().onboarding.hydrate();
    updateSettings.mockClear();

    await store.getState().onboarding.dismiss("unknown-beacon");

    expect(updateSettings).not.toHaveBeenCalled();
    expect(store.getState().onboarding.dismissedBeacons).toEqual([
      "game-selector",
    ]);
  });
});
