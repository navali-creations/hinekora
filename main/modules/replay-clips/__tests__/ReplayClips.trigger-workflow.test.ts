import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";

import { createDefaultSettings, type ManagedRecorderStatus } from "~/types";
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

function createActiveManagedRecorderStatus(): ManagedRecorderStatus {
  return {
    activeSessionDirectory: null,
    available: true,
    bufferActive: true,
    encoder: "hardware_h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: root,
    outputResolution: "native",
    recording: true,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingSession: null,
    runtime: "packaged_obs",
    runtimePath: null,
  };
}

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

  it("skips the preview overlay when manual replay previews are disabled", async () => {
    const replayPath = join(root, "2026-06-12_10-29-00.mp4");
    writeFileSync(replayPath, "video");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        manualReplayShowPreview: false,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: createActiveManagedRecorderStatus,
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    const showClipPreviewOverlay = vi.fn();
    const showReplayStatusOverlay = vi.fn().mockResolvedValue(undefined);
    const finishReplayStatusOverlay = vi.fn();
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      finishReplayStatusOverlay,
      showClipPreviewOverlay,
      showReplayStatusOverlay,
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      noteReplayClipUsageChange: vi.fn(),
      scheduleCleanup: vi.fn(),
      publishUsageChanged: vi.fn(),
    } as unknown as RecordingStorageService);

    await expect(service.saveManualReplay()).resolves.toMatchObject({
      kind: "manual",
      status: "ready",
      processedClipPath: resolve(replayPath),
    });
    expect(showClipPreviewOverlay).not.toHaveBeenCalled();
    expect(showReplayStatusOverlay).toHaveBeenCalledWith(expect.any(String));
    expect(finishReplayStatusOverlay).toHaveBeenCalledWith(
      expect.any(String),
      "saved",
    );
  });

  it("finishes the status overlay as failed when a manual replay save fails", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        manualReplayShowPreview: false,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: createActiveManagedRecorderStatus,
      saveReplay: vi.fn().mockResolvedValue({
        error: "save failed",
        ok: false,
        path: null,
      }),
    } as unknown as ManagedRecorderService);
    const finishReplayStatusOverlay = vi.fn(() => {
      throw new Error("status overlay unavailable");
    });
    const showReplayStatusOverlay = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      finishReplayStatusOverlay,
      showReplayStatusOverlay,
    } as unknown as OverlayWindowsService);

    const failed = await service.saveManualReplay();

    expect(failed).toMatchObject({
      error: "save failed",
      kind: "manual",
      status: "failed",
    });
    expect(showReplayStatusOverlay).toHaveBeenCalledWith(failed?.id);
    expect(finishReplayStatusOverlay).toHaveBeenCalledWith(
      failed?.id,
      "failed",
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
        manualReplaySeconds: 27,
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
        runRecordingSession: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        error: null,
      }),
      saveReplay,
    } as unknown as ManagedRecorderService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay: vi.fn(),
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      noteReplayClipUsageChange: vi.fn(),
      scheduleCleanup: vi.fn(),
      publishUsageChanged: vi.fn(),
    } as unknown as RecordingStorageService);

    const first = service.saveManualReplay();
    await vi.waitFor(() => expect(saveReplay).toHaveBeenCalledTimes(1));
    const savingClip = repository.list()[0];
    expect(savingClip).toBeDefined();
    let updateSettled = false;
    const update = service
      .updateClipFile({ id: savingClip!.id, name: "Coalesced replay" })
      .finally(() => {
        updateSettled = true;
      });
    const second = service.handleDeathEvent({
      game: "poe1",
      line: "You have died.",
      lineHash: "overlapping-death",
      detectedAt: "2026-06-12T10:00:00.000Z",
    });
    const third = service.saveManualReplay();
    await Promise.resolve();
    expect(updateSettled).toBe(false);
    saveGate.resolve();

    const [manualClip, deathClip, coalescedManualClip, updateResult] =
      await Promise.all([first, second, third, update]);
    expect(manualClip?.id).toBe(deathClip?.id);
    expect(coalescedManualClip?.id).toBe(deathClip?.id);
    expect(manualClip).toMatchObject({
      deathTimestamp: "2026-06-12T10:00:00.000Z",
      kind: "death",
      triggerLineHash: "overlapping-death",
    });
    expect(repository.list()[0]).toMatchObject({
      kind: "death",
      processedClipPath: expect.stringContaining("Coalesced replay.mp4"),
      triggerLineHash: "overlapping-death",
    });
    expect(updateResult.ok).toBe(true);
    expect(repository.list()).toHaveLength(1);
    expect(saveReplay).toHaveBeenCalledOnce();
    expect(saveReplay).toHaveBeenCalledWith(27, "manual");
    expect(manualClip?.targetDurationSeconds).toBe(27);
  });

  it("does not trigger automatic replay creation when death clips are disabled", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        deathClipsEnabled: false,
      }),
    } as unknown as SettingsStoreService);
    const handleReplayTrigger = vi.spyOn(service, "handleReplayTrigger");

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "disabled-death-hash",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toBeNull();
    expect(handleReplayTrigger).not.toHaveBeenCalled();
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
        runRecordingSession: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
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
        runRecordingSession: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
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
        runRecordingSession: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
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
        runRecordingSession: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
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
      runRecordingSession: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
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
      runRecordingSession: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
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
      runRecordingSession: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
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
      noteReplayClipUsageChange: vi.fn(),
      scheduleCleanup: vi.fn(),
      publishUsageChanged: vi.fn(),
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
    const showClipPreviewOverlay = vi
      .fn()
      .mockRejectedValue(new Error("overlay unavailable"));
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
        runRecordingSession: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
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
    const noteReplayClipUsageChange = vi.fn();
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      noteReplayClipUsageChange,
      scheduleCleanup: cleanup,
      publishUsageChanged: vi.fn(),
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
      framesPerSecond: 60,
      kind: "death",
      status: "ready",
      processedClipPath: resolve(replayPath),
      targetDurationSeconds: 10,
    });
    expect(duplicate.id).toBe(ready.id);
    expect(showClipPreviewOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ id: ready.id, status: "saving_replay" }),
    );
    const publishedClips = send.mock.calls
      .filter(([channel]) => channel === ReplayClipsChannel.StatusChanged)
      .map(([, clip]) => clip as { hasMediaFile: boolean; status: string });
    expect(
      publishedClips
        .filter((clip) => clip.status === "saving_replay")
        .every((clip) => !clip.hasMediaFile),
    ).toBe(true);
    expect(publishedClips.at(-1)).toMatchObject({
      hasMediaFile: true,
      status: "ready",
    });
    expect(cleanup).toHaveBeenCalledWith({
      estimatedAddedBytes: 5,
      force: false,
      usageAlreadyAccounted: true,
      protectedPaths: [resolve(replayPath), resolve(replayPath)],
    });
    expect(noteReplayClipUsageChange).toHaveBeenCalledWith(
      expect.objectContaining({ sizeBytes: 0 }),
      expect.objectContaining({ sizeBytes: 5 }),
    );
  });
});
