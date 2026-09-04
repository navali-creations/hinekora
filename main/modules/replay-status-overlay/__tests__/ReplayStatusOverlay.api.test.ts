import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: electronMocks,
}));

import { ReplayStatusOverlayAPI } from "../ReplayStatusOverlay.api";
import { ReplayStatusOverlayChannel } from "../ReplayStatusOverlay.channels";

describe("ReplayStatusOverlayAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards only valid statuses and removes the exact listener", () => {
    const callback = vi.fn();
    const unsubscribe = ReplayStatusOverlayAPI.onStatusChanged(callback);
    const listener = electronMocks.on.mock.calls[0]?.[1];

    expect(electronMocks.on).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      expect.any(Function),
    );

    listener?.({}, { clipId: "clip-1", dismissing: false, status: "saved" });
    listener?.({}, { clipId: "", dismissing: false, status: "saved" });
    listener?.({}, { clipId: "clip-1", dismissing: "no", status: "saved" });
    listener?.({}, { clipId: "clip-1", dismissing: false, status: "unknown" });

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({
      clipId: "clip-1",
      dismissing: false,
      status: "saved",
    });

    unsubscribe();
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      listener,
    );
  });
});
