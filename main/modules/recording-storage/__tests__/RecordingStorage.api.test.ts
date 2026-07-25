import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: electronMocks,
}));

import { RecordingStorageAPI } from "../RecordingStorage.api";
import { RecordingStorageChannel } from "../RecordingStorage.channels";

describe("RecordingStorageAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a validated cached usage snapshot", async () => {
    const usage = {
      clipsSizeBytes: 1_024,
      diskFreeBytes: 4_096,
      lowDiskSpace: false,
      recordingsSizeBytes: 2_048,
      exportVideosSizeBytes: 512,
      exportVideosUsageTruncated: false,
    };
    electronMocks.invoke.mockResolvedValue(usage);

    await expect(RecordingStorageAPI.getUsage()).resolves.toEqual(usage);
    expect(electronMocks.invoke).toHaveBeenCalledWith(
      RecordingStorageChannel.GetUsage,
    );
  });

  it("returns null while the initial usage snapshot is deferred", async () => {
    electronMocks.invoke.mockResolvedValue(null);

    await expect(RecordingStorageAPI.getUsage()).resolves.toBeNull();
  });

  it("rejects malformed usage snapshots from IPC", async () => {
    electronMocks.invoke.mockResolvedValue({
      clipsSizeBytes: -1,
      diskFreeBytes: 4_096,
      lowDiskSpace: false,
      recordingsSizeBytes: 2_048,
    });

    await expect(RecordingStorageAPI.getUsage()).rejects.toThrow();
  });

  it("validates usage refresh failures before notifying the renderer", () => {
    const callback = vi.fn();
    RecordingStorageAPI.onUsageRefreshFailed(callback);
    const listener = electronMocks.on.mock.calls[0]?.[1] as (
      event: Electron.IpcRendererEvent,
      error: unknown,
    ) => void;

    listener({} as Electron.IpcRendererEvent, "");
    listener({} as Electron.IpcRendererEvent, "x".repeat(2_049));
    listener({} as Electron.IpcRendererEvent, 500);
    listener(
      {} as Electron.IpcRendererEvent,
      "Recording storage usage could not be refreshed",
    );

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(
      "Recording storage usage could not be refreshed",
    );
  });

  it("removes the exact usage refresh failure listener", () => {
    const unsubscribe = RecordingStorageAPI.onUsageRefreshFailed(vi.fn());
    const listener = electronMocks.on.mock.calls[0]?.[1];

    unsubscribe();

    expect(electronMocks.on).toHaveBeenCalledWith(
      RecordingStorageChannel.UsageRefreshFailed,
      listener,
    );
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      RecordingStorageChannel.UsageRefreshFailed,
      listener,
    );
  });
});
