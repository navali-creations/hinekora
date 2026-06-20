import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayClipLibraryPage } from "~/main/modules/replay-clips/ReplayClips.dto";
import { createReplayClip } from "~/main/test/factories/replayClip";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { ReplayClip } from "~/types";
import { createReplayClipsSlice } from "./ReplayClips.slice";

function createLibraryPage(items: ReplayClip[] = []): ReplayClipLibraryPage {
  return {
    items,
    availableLeagues: ["Standard"],
    pageIndex: 0,
    pageSize: 20,
    pageCount: 1,
    totalCount: items.length,
    sortBy: "createdAt",
    sortDirection: "desc",
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createReplayClipsSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("ReplayClips slice", () => {
  const list = vi.fn();
  const listLibrary = vi.fn();
  const saveManual = vi.fn();
  const open = vi.fn();
  const reveal = vi.fn();
  const deleteClip = vi.fn();
  const deleteMany = vi.fn();
  const onStatusChanged = vi.fn();
  let statusChangedListener: ((clip: ReplayClip | null) => void) | null = null;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    statusChangedListener = null;
    list.mockResolvedValue([]);
    listLibrary.mockResolvedValue(createLibraryPage());
    saveManual.mockResolvedValue(null);
    open.mockResolvedValue({ ok: true, error: null });
    reveal.mockResolvedValue({ ok: true, error: null });
    deleteClip.mockResolvedValue({ ok: true, error: null });
    deleteMany.mockResolvedValue({
      ok: true,
      error: null,
      deletedIds: [],
      failed: [],
    });
    onStatusChanged.mockImplementation(
      (listener: (clip: ReplayClip | null) => void) => {
        statusChangedListener = listener;
        return unsubscribe;
      },
    );

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        replayClips: {
          list,
          listLibrary,
          saveManual,
          open,
          reveal,
          delete: deleteClip,
          deleteMany,
          onStatusChanged,
        },
      },
    });
  });

  it("surfaces single clip delete failures without refreshing", async () => {
    deleteClip.mockResolvedValue({
      ok: false,
    });
    const store = createTestStore();

    await store.getState().replayClips.deleteClip("clip-1");

    expect(store.getState().replayClips.error).toBe("Clip delete failed");
    expect(list).not.toHaveBeenCalled();
  });

  it("hydrates and refreshes the clip library", async () => {
    const clip = createReplayClip({ id: "clip-1" });
    list.mockResolvedValue([clip]);
    listLibrary.mockResolvedValue(createLibraryPage([clip]));
    const store = createTestStore();

    await store.getState().replayClips.hydrate();
    await store.getState().replayClips.refreshLibrary();
    expect(listLibrary).not.toHaveBeenCalled();

    await store.getState().replayClips.hydrateLibrary({ game: "poe2" });
    await store.getState().replayClips.refreshLibrary();

    expect(store.getState().replayClips).toMatchObject({
      error: null,
      items: [clip],
      libraryItems: [clip],
      libraryLeagues: ["Standard"],
      selectedClipIds: {},
    });
    expect(listLibrary).toHaveBeenLastCalledWith({ game: "poe2" });
  });

  it("saves manual clips and keeps the previous active clip when none is returned", async () => {
    const activeClip = createReplayClip({ id: "active-clip" });
    const savedClip = createReplayClip({ id: "saved-clip" });
    list.mockResolvedValue([activeClip, savedClip]);
    saveManual.mockResolvedValueOnce(savedClip).mockResolvedValueOnce(null);
    const store = createTestStore();
    store.setState((state) => ({
      replayClips: {
        ...state.replayClips,
        activeClip,
      },
    }));

    await store.getState().replayClips.saveManual();
    expect(store.getState().replayClips.activeClip).toBe(savedClip);

    await store.getState().replayClips.saveManual();
    expect(store.getState().replayClips.activeClip).toBe(savedClip);
  });

  it("opens and reveals clips", async () => {
    const store = createTestStore();

    await store.getState().replayClips.openClip("clip-1");
    await store.getState().replayClips.revealClip("clip-1");

    expect(open).toHaveBeenCalledWith("clip-1");
    expect(reveal).toHaveBeenCalledWith("clip-1");
  });

  it("refreshes after single clip delete cleanup warnings and keeps the warning", async () => {
    deleteClip.mockResolvedValue({
      ok: true,
      error: null,
      cleanupError: "unlink failed",
    });
    const store = createTestStore();

    await store.getState().replayClips.deleteClip("clip-1");

    expect(list).toHaveBeenCalledTimes(1);
    expect(store.getState().replayClips.error).toBe("unlink failed");
  });

  it("clears an active deleted clip and default cleanup state", async () => {
    const clip = createReplayClip({ id: "clip-1" });
    const store = createTestStore();
    store.setState((state) => ({
      replayClips: {
        ...state.replayClips,
        activeClip: clip,
        selectedClipIds: { [clip.id]: true },
      },
    }));

    await store.getState().replayClips.deleteClip(clip.id);

    expect(store.getState().replayClips.activeClip).toBeNull();
    expect(store.getState().replayClips.selectedClipIds).toEqual({});
    expect(store.getState().replayClips.error).toBeNull();
  });

  it("surfaces batch clip cleanup warnings after clearing selection", async () => {
    const clip = createReplayClip({ id: "clip-1" });
    deleteMany.mockResolvedValue({
      ok: true,
      error: null,
      deletedIds: [clip.id],
      failed: [],
      cleanupErrors: [{ id: clip.id, error: "unlink failed" }],
    });
    listLibrary.mockResolvedValue(createLibraryPage([]));
    const store = createTestStore();
    store.setState((state) => ({
      replayClips: {
        ...state.replayClips,
        libraryQuery: { game: "poe2" },
        libraryItems: [clip],
        selectedClipIds: { [clip.id]: true },
      },
    }));

    await store.getState().replayClips.deleteSelectedClips();

    expect(deleteMany).toHaveBeenCalledWith([clip.id]);
    expect(listLibrary).toHaveBeenCalledWith({ game: "poe2" });
    expect(store.getState().replayClips.selectedClipIds).toEqual({});
    expect(store.getState().replayClips.error).toBe("unlink failed");
  });

  it("skips empty batch deletes and reports batch failures", async () => {
    const clip = createReplayClip({ id: "clip-1" });
    const store = createTestStore();

    await store.getState().replayClips.deleteSelectedClips();
    expect(deleteMany).not.toHaveBeenCalled();

    deleteMany.mockResolvedValueOnce({
      ok: false,
      error: "Delete failed",
      deletedIds: [],
      failed: [{ id: clip.id, error: "Delete failed" }],
    });
    store.setState((state) => ({
      replayClips: {
        ...state.replayClips,
        selectedClipIds: { [clip.id]: true },
      },
    }));
    await store.getState().replayClips.deleteSelectedClips();

    expect(store.getState().replayClips.error).toBe("Delete failed");

    deleteMany.mockResolvedValueOnce({
      ok: true,
      deletedIds: [clip.id],
      failed: [],
    });
    store.setState((state) => ({
      replayClips: {
        ...state.replayClips,
        selectedClipIds: { [clip.id]: true },
      },
    }));
    await store.getState().replayClips.deleteSelectedClips();
    expect(store.getState().replayClips.error).toBeNull();
  });

  it("sets, clears, and listens for selected clip state", async () => {
    const clip = createReplayClip({ id: "clip-1" });
    list.mockResolvedValue([clip]);
    const store = createTestStore();

    store.getState().replayClips.setSelectedClipIds({ [clip.id]: true });
    store.getState().replayClips.clearSelectedClips();
    const stopListening = store.getState().replayClips.startListening();
    statusChangedListener?.(clip);
    await Promise.resolve();
    await Promise.resolve();
    statusChangedListener?.(null);
    await Promise.resolve();
    await Promise.resolve();
    stopListening();

    expect(store.getState().replayClips.selectedClipIds).toEqual({});
    expect(store.getState().replayClips.activeClip).toBeNull();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
