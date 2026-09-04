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

  beforeEach(() => {
    listener = null;
    onStatusChanged.mockClear();
    unsubscribe.mockClear();
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { replayStatusOverlay: { onStatusChanged } },
    });
  });

  it("owns the replay status lifecycle and listener cleanup", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createReplayStatusOverlaySlice(set, get, api),
    );

    const stopListening = store
      .getState()
      .replayStatusOverlay.startListening("manual-1");
    expect(store.getState().replayStatusOverlay.status).toEqual({
      clipId: "manual-1",
      dismissing: false,
      status: "processing",
    });

    listener?.({ clipId: "manual-1", dismissing: false, status: "saved" });
    expect(store.getState().replayStatusOverlay.status?.status).toBe("saved");

    stopListening();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState().replayStatusOverlay.status).toBeNull();
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
    expect(stopListening()).toBeUndefined();
  });
});
