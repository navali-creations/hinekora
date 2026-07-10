import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ReplayClipLibraryPage,
  ReplayClipView,
} from "~/main/modules/replay-clips/ReplayClips.dto";
import { createReplayClipView } from "~/main/test/factories/replayClip";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createReplayClipsSlice } from "./ReplayClips.slice";

function createLibraryPage(
  items: ReplayClipView[] = [],
): ReplayClipLibraryPage {
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
  const listLibrary = vi.fn();
  const saveManualReplay = vi.fn();
  const open = vi.fn();
  const reveal = vi.fn();
  const deleteClip = vi.fn();
  const deleteMany = vi.fn();
  const onStatusChanged = vi.fn();
  let statusChangedListener: ((clip: ReplayClipView) => void) | null = null;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    statusChangedListener = null;
    listLibrary.mockResolvedValue(createLibraryPage());
    saveManualReplay.mockResolvedValue(null);
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
      (listener: (clip: ReplayClipView) => void) => {
        statusChangedListener = listener;
        return unsubscribe;
      },
    );

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        replayClips: {
          listLibrary,
          saveManualReplay,
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
    expect(listLibrary).not.toHaveBeenCalled();
  });

  it("hydrates and refreshes the clip library", async () => {
    const clip = createReplayClipView({ id: "clip-1" });
    listLibrary.mockResolvedValue(createLibraryPage([clip]));
    const store = createTestStore();

    await store.getState().replayClips.refreshLibrary();
    expect(listLibrary).not.toHaveBeenCalled();

    await store.getState().replayClips.hydrateLibrary({ game: "poe2" });
    await store.getState().replayClips.refreshLibrary();

    expect(store.getState().replayClips).toMatchObject({
      error: null,
      libraryItems: [clip],
      libraryLeagues: ["Standard"],
      selectedClipIds: {},
    });
    expect(listLibrary).toHaveBeenLastCalledWith({ game: "poe2" });
  });

  it("saves manual replays and keeps the previous active clip when none is returned", async () => {
    const activeClip = createReplayClipView({ id: "active-clip" });
    const savedClip = createReplayClipView({ id: "saved-clip" });
    saveManualReplay
      .mockResolvedValueOnce(savedClip)
      .mockResolvedValueOnce(null);
    const store = createTestStore();
    store.setState((state) => ({
      replayClips: {
        ...state.replayClips,
        activeClip,
      },
    }));

    await store.getState().replayClips.saveManualReplay();
    expect(store.getState().replayClips.activeClip).toBe(savedClip);

    await store.getState().replayClips.saveManualReplay();
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

    expect(listLibrary).not.toHaveBeenCalled();
    expect(store.getState().replayClips.error).toBe("unlink failed");
  });

  it("clears an active deleted clip and default cleanup state", async () => {
    const clip = createReplayClipView({ id: "clip-1" });
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
    const clip = createReplayClipView({ id: "clip-1" });
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
    const clip = createReplayClipView({ id: "clip-1" });
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
    const clip = createReplayClipView({ id: "clip-1" });
    const store = createTestStore();

    store.getState().replayClips.setSelectedClipIds({ [clip.id]: true });
    store.getState().replayClips.clearSelectedClips();
    const stopListening = store.getState().replayClips.startListening();
    statusChangedListener?.(clip);
    await Promise.resolve();
    await Promise.resolve();
    stopListening();

    expect(store.getState().replayClips.selectedClipIds).toEqual({});
    expect(store.getState().replayClips.activeClip).toBe(clip);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("keeps the newest library response when requests resolve out of order", async () => {
    const deathClip = createReplayClipView({ id: "death-clip" });
    const manualClip = createReplayClipView({ id: "manual-clip" });
    let resolveDeathPage!: (page: ReplayClipLibraryPage) => void;
    let resolveManualPage!: (page: ReplayClipLibraryPage) => void;
    listLibrary
      .mockReturnValueOnce(
        new Promise<ReplayClipLibraryPage>((resolve) => {
          resolveDeathPage = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<ReplayClipLibraryPage>((resolve) => {
          resolveManualPage = resolve;
        }),
      );
    const store = createTestStore();

    const deathRequest = store
      .getState()
      .replayClips.hydrateLibrary({ kind: "death" });
    const manualRequest = store
      .getState()
      .replayClips.hydrateLibrary({ kind: "manual" });
    resolveManualPage(createLibraryPage([manualClip]));
    await manualRequest;
    resolveDeathPage(createLibraryPage([deathClip]));
    await deathRequest;

    expect(store.getState().replayClips.libraryQuery).toEqual({
      kind: "manual",
    });
    expect(store.getState().replayClips.libraryItems).toEqual([manualClip]);
  });

  it("surfaces library request failures", async () => {
    listLibrary.mockRejectedValueOnce(new Error("Library unavailable"));
    const store = createTestStore();

    await store.getState().replayClips.hydrateLibrary({ game: "poe2" });

    expect(store.getState().replayClips.error).toBe("Library unavailable");
  });
});
