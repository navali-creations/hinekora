import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: electronMocks,
}));

import { StorageAPI } from "../Storage.api";
import { StorageChannel } from "../Storage.channels";

const info = {
  appInstallationOnStorageDrive: true,
  appInstallationSizeBytes: 1,
  breakdown: [],
  calculatedAt: "2026-07-23T00:00:00.000Z",
  databaseOnStorageDrive: true,
  databaseSizeBytes: 1,
  diskFreeBytes: 10,
  diskTotalBytes: 20,
  exportStorageVolumes: [],
  exportVideosUsageTruncated: false,
  recordingUsageTruncated: false,
  recordingsSizeBytes: 2,
  rewindBufferEstimateBytes: 0,
  storagePath: "C:\\**\\Hinekora Recordings",
  temporarySizeBytes: 0,
  totalTrackedSizeBytes: 4,
};

describe("StorageAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates storage IPC responses", async () => {
    electronMocks.invoke
      .mockResolvedValueOnce(info)
      .mockResolvedValueOnce([
        {
          clipCount: 1,
          estimatedSizeBytes: 2,
          game: "poe2",
          hasActiveRecording: false,
          id: "poe2:Standard",
          leagueName: "Standard",
          recordingCount: 1,
        },
      ])
      .mockResolvedValueOnce({
        deletedClipCount: 1,
        deletedRecordingCount: 1,
        freedBytes: 2,
        success: true,
      })
      .mockResolvedValueOnce({
        databasePath: "C:\\Data\\hinekora.sqlite",
        exportStoragePath: "C:\\Videos\\Hinekora Exports",
        exportStorageVolumes: [],
        storagePath: "C:\\Videos\\Hinekora Recordings",
      });

    await expect(StorageAPI.getInfo()).resolves.toEqual(info);
    await expect(StorageAPI.getGameLeagueUsage()).resolves.toHaveLength(1);
    await expect(
      StorageAPI.deleteGameLeagueData({
        game: "poe2",
        leagueName: "Standard",
      }),
    ).resolves.toMatchObject({ success: true });
    await expect(StorageAPI.revealPaths()).resolves.toMatchObject({
      exportStoragePath: "C:\\Videos\\Hinekora Exports",
    });
    expect(electronMocks.invoke.mock.calls).toEqual([
      [StorageChannel.GetInfo],
      [StorageChannel.GetGameLeagueUsage],
      [
        StorageChannel.DeleteGameLeagueData,
        { game: "poe2", leagueName: "Standard" },
      ],
      [StorageChannel.RevealPaths],
    ]);
  });

  it("rejects malformed storage IPC responses", async () => {
    electronMocks.invoke.mockResolvedValue({ ...info, diskFreeBytes: -1 });
    await expect(StorageAPI.getInfo()).rejects.toThrow();

    electronMocks.invoke.mockResolvedValue([{ game: "poe3" }]);
    await expect(StorageAPI.getGameLeagueUsage()).rejects.toThrow();

    electronMocks.invoke.mockResolvedValue({ success: true });
    await expect(
      StorageAPI.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Standard",
      }),
    ).rejects.toThrow();

    electronMocks.invoke.mockResolvedValue({ storagePath: 500 });
    await expect(StorageAPI.revealPaths()).rejects.toThrow();
  });
});
