import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayStatusOverlayEvent } from "~/main/modules/replay-status-overlay/ReplayStatusOverlay.dto";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createReplayStatusOverlaySlice } from "./ReplayStatusOverlay.slice";

describe("ReplayStatusOverlay slice", () => {
  let listener: ((status: ReplayStatusOverlayEvent) => void) | null;
  const onStatusChanged = vi.fn(
    (callback: (status: ReplayStatusOverlayEvent) => void) => {
      listener = callback;
      return unsubscribe;
    },
  );
  const unsubscribe = vi.fn();
  const getSnapshot = vi.fn<() => Promise<ReplayStatusOverlayEvent | null>>();

  beforeEach(() => {
    listener = null;
    onStatusChanged.mockClear();
    unsubscribe.mockClear();
    getSnapshot.mockReset().mockResolvedValue({
      clipId: "manual-1",
      dismissing: false,
      status: "saving",
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { replayStatusOverlay: { getSnapshot, onStatusChanged } },
    });
  });

  it("subscribes before reading the snapshot and cleans up its listener", async () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );

    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening("manual-1");
    expect(onStatusChanged.mock.invocationCallOrder[0]).toBeLessThan(
      getSnapshot.mock.invocationCallOrder[0]!,
    );
    await Promise.resolve();
    expect(store.getState().replayStatusOverlay.status).toEqual({
      clipId: "manual-1",
      dismissing: false,
      status: "saving",
    });

    listener?.({ clipId: "manual-1", dismissing: false, status: "processing" });
    expect(store.getState().replayStatusOverlay.status?.status).toBe(
      "processing",
    );

    listener?.({ clipId: "manual-1", dismissing: false, status: "saved" });
    expect(store.getState().replayStatusOverlay.status?.status).toBe("saved");

    stopListening();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState().replayStatusOverlay.status).toBeNull();
  });

  it.each(["processing", "saved", "failed"] as const)(
    "recovers a missed %s event from the current snapshot",
    async (status) => {
      getSnapshot.mockResolvedValue({
        clipId: "manual-1",
        dismissing: status === "saved",
        status,
      });
      const store = createBoundStoreForTests((set, get, api) =>
        createReplayStatusOverlaySlice(set, get, api),
      );
      const stopListening = store
        .getState()
        .replayStatusOverlay.startListening("manual-1");
      await Promise.resolve();
      expect(store.getState().replayStatusOverlay.status).toEqual({
        clipId: "manual-1",
        dismissing: status === "saved",
        status,
      });
      stopListening();
    },
  );

  it("does not overwrite a newer event with a delayed snapshot", async () => {
    let resolveSnapshot!: (status: ReplayStatusOverlayEvent) => void;
    getSnapshot.mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );
    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening("manual-1");
    listener?.({ clipId: "manual-2", dismissing: false, status: "processing" });
    resolveSnapshot({
      clipId: "manual-1",
      dismissing: false,
      status: "saving",
    });
    await Promise.resolve();
    expect(store.getState().replayStatusOverlay.status).toEqual({
      clipId: "manual-2",
      dismissing: false,
      status: "processing",
    });
    stopListening();
  });

  it("ignores a snapshot and queued events after listener cleanup", async () => {
    let resolveSnapshot!: (status: ReplayStatusOverlayEvent) => void;
    getSnapshot.mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );
    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening("manual-1");
    stopListening();
    listener?.({ clipId: "manual-1", dismissing: false, status: "saved" });
    resolveSnapshot({
      clipId: "manual-1",
      dismissing: false,
      status: "saving",
    });
    await Promise.resolve();
    expect(store.getState().replayStatusOverlay.status).toBeNull();
  });

  it("keeps listening when the initial snapshot fails", async () => {
    getSnapshot.mockRejectedValue(new Error("snapshot unavailable"));
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );
    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening("manual-1");
    await Promise.resolve();
    listener?.({ clipId: "manual-1", dismissing: false, status: "saved" });
    expect(store.getState().replayStatusOverlay.status?.status).toBe("saved");
    stopListening();
  });

  it("stays empty when there is no active notification", async () => {
    getSnapshot.mockResolvedValue(null);
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );
    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening("manual-1");
    await Promise.resolve();
    expect(store.getState().replayStatusOverlay.status).toBeNull();
    stopListening();
  });

  it("stays empty and avoids IPC for invalid route state", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );

    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening(null);

    expect(store.getState().replayStatusOverlay.status).toBeNull();
    expect(onStatusChanged).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(stopListening()).toBeUndefined();
  });
});
