import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { Profile } from "~/types";
import { createProfilesSlice } from "./Profiles.slice";

function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    captureTarget: null,
    createdAt: "2026-06-18T00:00:00.000Z",
    cropRegions: [],
    game: "poe2",
    id: "profile-1",
    name: "PoE 2",
    overlayPlacements: [],
    targetFps: 60,
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createProfilesSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("Profiles slice", () => {
  const createdProfile = createProfile({ id: "created", name: "Created" });
  const profiles = [createProfile(), createProfile({ id: "profile-2" })];
  const createProfileApi = vi.fn();
  const listProfiles = vi.fn();
  const updateProfile = vi.fn();
  const unsubscribe = vi.fn();
  let changedListener: ((items: Profile[]) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    changedListener = null;
    createProfileApi.mockResolvedValue(createdProfile);
    listProfiles.mockResolvedValue(profiles);
    updateProfile.mockResolvedValue(profiles[1]);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        profiles: {
          create: createProfileApi,
          list: listProfiles,
          update: updateProfile,
          onChanged: vi.fn((listener: (items: Profile[]) => void) => {
            changedListener = listener;
            return unsubscribe;
          }),
        },
      },
    });
  });

  it("hydrates profiles and preserves an existing selected profile", async () => {
    const store = createTestStore();
    store.getState().profiles.select("profile-2");

    await store.getState().profiles.hydrate();

    expect(store.getState().profiles).toMatchObject({
      error: null,
      isLoading: false,
      items: profiles,
      selectedProfileId: "profile-2",
    });
  });

  it("falls back to the first profile and stores hydrate errors", async () => {
    const store = createTestStore();
    store.getState().profiles.select("missing");

    await store.getState().profiles.hydrate();
    expect(store.getState().profiles.selectedProfileId).toBe("profile-1");

    listProfiles.mockRejectedValueOnce(new Error("offline"));
    await store.getState().profiles.hydrate();
    expect(store.getState().profiles.error).toBe("offline");

    listProfiles.mockRejectedValueOnce("offline");
    await store.getState().profiles.hydrate();
    expect(store.getState().profiles.error).toBe("Load failed");

    listProfiles.mockResolvedValueOnce([]);
    await store.getState().profiles.hydrate();
    expect(store.getState().profiles.selectedProfileId).toBeNull();
  });

  it("creates and updates profiles", async () => {
    const store = createTestStore();

    await store.getState().profiles.create("Mapper");
    expect(createProfileApi).toHaveBeenCalledWith({
      game: "poe1",
      name: "Mapper",
    });
    expect(store.getState().profiles.selectedProfileId).toBe("created");

    await store
      .getState()
      .profiles.update({ id: "profile-2", name: "Renamed" });
    expect(updateProfile).toHaveBeenCalledWith({
      id: "profile-2",
      name: "Renamed",
    });
    expect(store.getState().profiles.selectedProfileId).toBe("profile-2");
  });

  it("listens for profile changes and cleans up", () => {
    const store = createTestStore();
    const stopListening = store.getState().profiles.startListening();

    changedListener?.(profiles);
    expect(store.getState().profiles.selectedProfileId).toBe("profile-1");

    store.getState().profiles.select("profile-2");
    changedListener?.(profiles);
    expect(store.getState().profiles.selectedProfileId).toBe("profile-2");

    changedListener?.([profiles[0]!]);
    expect(store.getState().profiles.selectedProfileId).toBe("profile-1");

    changedListener?.([]);
    expect(store.getState().profiles.selectedProfileId).toBeNull();

    stopListening();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
