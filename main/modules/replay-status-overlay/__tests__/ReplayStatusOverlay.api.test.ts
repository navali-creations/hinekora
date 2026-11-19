import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
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
    electronMocks.invoke.mockReset();
  });

  it("reads and validates the current snapshot", async () => {
    const snapshot = { clipId: "clip-1", dismissing: false, status: "saved" };
    electronMocks.invoke
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(null);

    await expect(ReplayStatusOverlayAPI.getSnapshot()).resolves.toEqual(
      snapshot,
    );
    expect(electronMocks.invoke).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.GetSnapshot,
    );
    await expect(ReplayStatusOverlayAPI.getSnapshot()).resolves.toBeNull();
  });

  it.each([
    undefined,
    { clipId: "", dismissing: false, status: "saved" },
    { clipId: "clip-1", dismissing: false, status: "unknown" },
    { clipId: "clip-1", dismissing: "no", status: "saving" },
  ])("rejects malformed snapshots: %j", async (snapshot) => {
    electronMocks.invoke.mockResolvedValue(snapshot);
    await expect(ReplayStatusOverlayAPI.getSnapshot()).rejects.toThrow(
      "Invalid replay status snapshot",
    );
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
    listener?.({}, { clipId: "clip-2", dismissing: false, status: "saving" });
    listener?.({}, { clipId: "", dismissing: false, status: "saved" });
    listener?.({}, { clipId: "clip-1", dismissing: "no", status: "saved" });
    listener?.({}, { clipId: "clip-1", dismissing: false, status: "unknown" });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith({
      clipId: "clip-1",
      dismissing: false,
      status: "saved",
    });
    expect(callback).toHaveBeenLastCalledWith({
      clipId: "clip-2",
      dismissing: false,
      status: "saving",
    });

    unsubscribe();
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      ReplayStatusOverlayChannel.StatusChanged,
      listener,
    );
  });
});
