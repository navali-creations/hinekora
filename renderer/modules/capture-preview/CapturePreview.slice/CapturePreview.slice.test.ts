import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { CapturePreviewSource, Profile } from "~/types";
import { createCapturePreviewSlice } from "./CapturePreview.slice";

const source: CapturePreviewSource = {
  displayId: "1",
  height: 1080,
  id: "screen:1",
  kind: "screen",
  name: "Screen 1",
  thumbnailDataUrl: null,
  width: 1920,
};

const profile: Profile = {
  captureTarget: {
    height: 1080,
    id: "screen:1",
    kind: "display",
    label: "Screen 1",
    width: 1920,
  },
  createdAt: "2026-06-18T00:00:00.000Z",
  cropRegions: [],
  game: "poe2",
  id: "profile-1",
  name: "PoE 2",
  overlayPlacements: [],
  targetFps: 60,
  updatedAt: "2026-06-18T00:00:00.000Z",
};

function createTestStore() {
  return createBoundStoreForTests((set, get, api) => {
    const capturePreviewSlice = createCapturePreviewSlice(set, get, api);

    return {
      ...capturePreviewSlice,
      profiles: {
        error: null,
        hydrate: vi.fn(),
        isLoading: false,
        items: [profile],
        selectedProfileId: profile.id,
        create: vi.fn(),
        update: vi.fn(),
        select: vi.fn(),
        startListening: vi.fn(),
      },
    } as unknown as BoundStore;
  });
}

function createTestStoreWithoutSelectedProfile() {
  const store = createTestStore();
  store.setState((state) => ({
    profiles: {
      ...state.profiles,
      selectedProfileId: "missing",
    },
  }));

  return store;
}

describe("CapturePreview slice", () => {
  const listSources = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    listSources.mockResolvedValue([source]);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        capturePreview: {
          listSources,
        },
      },
    });
  });

  it("hydrates and resolves the selected source from the selected profile", async () => {
    const store = createTestStore();

    await store.getState().capturePreview.hydrate();
    store.getState().capturePreview.select("screen:manual");
    await store.getState().capturePreview.refresh({ force: true });

    expect(listSources).toHaveBeenLastCalledWith(true);
    expect(store.getState().capturePreview).toMatchObject({
      error: null,
      isLoading: false,
      selectedSourceId: "screen:1",
      sources: [source],
    });
  });

  it("stores list errors", async () => {
    const store = createTestStore();
    listSources.mockRejectedValueOnce("blocked");

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview).toMatchObject({
      error: "Unable to list capture sources",
      isLoading: false,
    });
  });

  it("keeps an existing source when no selected profile target is available", async () => {
    const store = createTestStoreWithoutSelectedProfile();
    store.getState().capturePreview.select("screen:manual");

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.selectedSourceId).toBe("screen:1");
  });

  it("stores error messages from Error objects", async () => {
    const store = createTestStore();
    listSources.mockRejectedValueOnce(new Error("No permission"));

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.error).toBe("No permission");
  });
});
