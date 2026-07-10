import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";

import { createDefaultSettings } from "~/types";
import { ReplayClipsChannel } from "../ReplayClips.channels";
import {
  createDeferred,
  outsideRoot,
  repository,
  root,
  send,
  service,
  setupReplayClipsServiceTestHarness,
} from "./ReplayClips.service.test-harness";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  getPath: vi.fn(),
  isProtocolHandled: vi.fn(),
  netFetch: vi.fn(),
  openPath: vi.fn(),
  protocolHandle: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
  BrowserWindow: { getAllWindows: electronMocks.getAllWindows },
  net: { fetch: electronMocks.netFetch },
  protocol: {
    handle: electronMocks.protocolHandle,
    isProtocolHandled: electronMocks.isProtocolHandled,
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

setupReplayClipsServiceTestHarness(electronMocks);

describe("ReplayClipsService replay-trigger workflow", () => {
  it("saves manual replays using current settings", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const clip = createReplayClip({ sourceGame: "poe2" });
    const handleReplayTrigger = vi
      .spyOn(service, "handleReplayTrigger")
      .mockResolvedValue(clip);

    await expect(service.saveManualReplay()).resolves.toBe(clip);
    expect(handleReplayTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "manual",
        game: "poe2",
        line: "Manual replay save",
        lineHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      }),
    );
  });

  it("coalesces overlapping manual and death triggers into one clip", async () => {
    const replayPath = join(root, "2026-06-12_10-30-00.mp4");
    const saveGate = createDeferred();
    writeFileSync(replayPath, "video");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const saveReplay = vi.fn().mockImplementation(async () => {
      await saveGate.promise;
      return { ok: true, path: replayPath, error: null };
    });
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        gameRunning: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay,
    } as unknown as ManagedRecorderService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay: vi.fn(),
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup: vi.fn(),
    } as unknown as RecordingStorageService);

    const first = service.saveManualReplay();
    await vi.waitFor(() => expect(saveReplay).toHaveBeenCalledTimes(1));
    const second = service.handleDeathEvent({
      game: "poe1",
      line: "You have died.",
      lineHash: "overlapping-death",
      detectedAt: "2026-06-12T10:00:00.000Z",
    });
    const third = service.saveManualReplay();
    saveGate.resolve();

    const [manualClip, deathClip, coalescedManualClip] = await Promise.all([
      first,
      second,
      third,
    ]);
    expect(manualClip?.id).toBe(deathClip?.id);
    expect(coalescedManualClip?.id).toBe(deathClip?.id);
    expect(manualClip).toMatchObject({
      deathTimestamp: "2026-06-12T10:00:00.000Z",
      kind: "death",
      triggerLineHash: "overlapping-death",
    });
    expect(repository.list()[0]).toMatchObject({
      kind: "death",
      triggerLineHash: "overlapping-death",
    });
    expect(repository.list()).toHaveLength(1);
    expect(saveReplay).toHaveBeenCalledTimes(1);
  });

  it("does not clear a newer active replay request when an older request settles", async () => {
    let settleRequest!: (
      clip: ReturnType<typeof createReplayClip> | null,
    ) => void;
    const pendingRequest = new Promise<ReturnType<
      typeof createReplayClip
    > | null>((resolveRequest) => {
      settleRequest = resolveRequest;
    });
    const internals = service as unknown as {
      activeReplayTriggerRequest: Promise<ReturnType<
        typeof createReplayClip
      > | null> | null;
      handleReplayTriggerExclusive: () => Promise<ReturnType<
        typeof createReplayClip
      > | null>;
    };
    vi.spyOn(internals, "handleReplayTriggerExclusive").mockReturnValue(
      pendingRequest,
    );
    const olderRequest = service.handleReplayTrigger({
      detectedAt: "2026-06-12T10:00:00.000Z",
      game: "poe1",
      kind: "manual",
      line: "Manual replay save",
      lineHash: "older-request",
    });
    const newerRequest = Promise.resolve(null);
    internals.activeReplayTriggerRequest = newerRequest;

    settleRequest(null);
    await expect(olderRequest).resolves.toBeNull();
    expect(internals.activeReplayTriggerRequest).toBe(newerRequest);
    internals.activeReplayTriggerRequest = null;
  });

  it("skips death replay saves when the managed replay buffer is inactive", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Hardcore",
        deathClipSeconds: 12,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const saveReplay = vi.fn();
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: false,
        recording: false,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "death-hash",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toBeNull();
    expect(saveReplay).not.toHaveBeenCalled();
    expect(repository.list()).toEqual([]);
    expect(send).not.toHaveBeenCalledWith(
      ReplayClipsChannel.StatusChanged,
      expect.objectContaining({ triggerLineHash: "death-hash" }),
    );
  });

  it("keeps the managed replay save guard for inactive buffers", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const getStatus = vi
      .fn()
      .mockReturnValueOnce({
        available: true,
        initialized: true,
        bufferActive: true,
        gameRunning: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      })
      .mockReturnValue({
        available: true,
        initialized: true,
        bufferActive: false,
        gameRunning: true,
        recording: false,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      });
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "inactive-buffer-save",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Managed replay buffer is not active",
    });
  });

  it("skips death replay saves when the active game is not running", async () => {
    const saveReplay = vi.fn();
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        gameRunning: false,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "offline-death-hash",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toBeNull();
    expect(saveReplay).not.toHaveBeenCalled();
    expect(repository.list()).toEqual([]);
  });

  it("marks clips failed when managed replay saving fails or returns unsafe paths", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const status = {
      available: true,
      initialized: true,
      bufferActive: true,
      recording: true,
      isStartingRecording: false,
      isStoppingRecording: false,
      runRecordingActive: false,
      runtime: "packaged_obs",
      runtimePath: null,
      outputDirectory: root,
      outputResolution: "native",
      fps: 60,
      encoder: "hardware_h264",
      lastRecordingPath: null,
      runRecordingPath: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
      runRecordingStartedAt: null,
      error: null,
    };
    const saveReplay = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, path: null, error: "save failed" })
      .mockResolvedValueOnce({ ok: false, path: null, error: null })
      .mockResolvedValueOnce({ ok: true, path: null, error: null })
      .mockResolvedValueOnce({
        ok: true,
        path: join(outsideRoot, "2026-06-12_10-30-00.mp4"),
        error: null,
      });
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => status,
      saveReplay,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "save-failed",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "save failed",
    });
    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "fallback-error",
        detectedAt: "2026-06-12T10:00:00.500Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Managed recorder save failed",
    });
    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "null-path",
        detectedAt: "2026-06-12T10:00:01.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Recorder did not return a saved replay path",
    });
    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "unsafe-path",
        detectedAt: "2026-06-12T10:00:02.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Recorder returned a replay path outside managed storage",
    });
  });

  it("continues processing when a recent duplicate hash has no stored clip", async () => {
    const replayPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(replayPath, "video");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const inactiveStatus = {
      available: true,
      initialized: true,
      bufferActive: false,
      recording: false,
      isStartingRecording: false,
      isStoppingRecording: false,
      runRecordingActive: false,
      runtime: "packaged_obs",
      runtimePath: null,
      outputDirectory: root,
      outputResolution: "native",
      fps: 60,
      encoder: "hardware_h264",
      lastRecordingPath: null,
      runRecordingPath: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
      runRecordingStartedAt: null,
      error: null,
    };
    const activeStatus = {
      available: true,
      initialized: true,
      bufferActive: true,
      recording: true,
      isStartingRecording: false,
      isStoppingRecording: false,
      runRecordingActive: false,
      runtime: "packaged_obs",
      runtimePath: null,
      outputDirectory: root,
      outputResolution: "native",
      fps: 60,
      encoder: "hardware_h264",
      lastRecordingPath: null,
      runRecordingPath: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
      runRecordingStartedAt: null,
      error: null,
    };
    const getStatus = vi
      .fn()
      .mockReturnValueOnce(inactiveStatus)
      .mockReturnValue(activeStatus);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus,
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay: vi.fn(),
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup: vi.fn(),
    } as unknown as RecordingStorageService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "orphan-duplicate",
        detectedAt: "2026-06-12T09:59:59.000Z",
      }),
    ).resolves.toBeNull();

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "orphan-duplicate",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      processedClipPath: resolve(replayPath),
    });
  });

  it("saves a ready managed replay, opens the pending preview, cleans storage, and ignores duplicates", async () => {
    const replayPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(replayPath, "video");
    const showClipPreviewOverlay = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn();
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay,
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);

    const event = {
      game: "poe1" as const,
      line: "You have died.",
      lineHash: "ready-hash",
      detectedAt: "2026-06-12T10:00:00.000Z",
    };
    const ready = await service.handleDeathEvent(event);
    expect(ready).not.toBeNull();
    if (!ready) {
      throw new Error("expected ready clip");
    }
    const duplicate = await service.handleDeathEvent(event);
    expect(duplicate).not.toBeNull();
    if (!duplicate) {
      throw new Error("expected duplicate clip");
    }

    expect(ready).toMatchObject({
      kind: "death",
      status: "ready",
      processedClipPath: resolve(replayPath),
      targetDurationSeconds: 10,
    });
    expect(duplicate.id).toBe(ready.id);
    expect(showClipPreviewOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ id: ready.id, status: "saving_replay" }),
    );
    expect(cleanup).toHaveBeenCalledWith({
      protectedPaths: [resolve(replayPath), resolve(replayPath)],
    });
  });
});
