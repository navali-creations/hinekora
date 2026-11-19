import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookmarksService } from "~/main/modules/bookmarks";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";

import { createDefaultSettings, type ReplayClip } from "~/types";
import { ReplayClipCreationService } from "../ReplayClips.creation";

let directory: string;
let replayPath: string;
let releaseSave: () => void;
let service: ReplayClipCreationService;
let dependencies: ConstructorParameters<typeof ReplayClipCreationService>[0];
const overlay = {
  finishReplayStatusOverlay: vi.fn(),
  setReplaySaveActive: vi.fn<(id: string, active: boolean) => void>(),
  showClipPreviewOverlay: vi.fn<(clip: ReplayClip) => Promise<boolean>>(),
  showReplayStatusOverlay: vi.fn().mockResolvedValue(undefined),
};
const saveReplay = vi.fn();
const deathEvent = {
  detectedAt: "2026-07-10T00:00:00.000Z",
  game: "poe1" as const,
  kind: "death" as const,
  line: "You have died.",
  lineHash: "death-preview",
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hinekora-preview-recovery-"));
  replayPath = join(directory, "replay.mp4");
  writeFileSync(replayPath, "video");
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  saveReplay.mockReset().mockImplementation(async () => {
    await saveGate;
    return { error: null, ok: true, path: replayPath };
  });
  overlay.setReplaySaveActive.mockReset();
  overlay.showClipPreviewOverlay.mockReset().mockResolvedValue(true);
  overlay.showReplayStatusOverlay.mockClear();
  overlay.finishReplayStatusOverlay.mockClear();
  vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue(
    overlay as unknown as OverlayWindowsService,
  );
  vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
    getStatus: () => ({ bufferActive: true, fps: 60, gameRunning: true }),
    saveReplay,
  } as unknown as ManagedRecorderService);
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => ({ ...createDefaultSettings(), manualReplayShowPreview: false }),
  } as unknown as SettingsStoreService);
  vi.spyOn(BookmarksService, "getInstance").mockReturnValue({
    rememberReplayClipSession: vi.fn(),
  } as unknown as BookmarksService);
  dependencies = {
    persistAndPublish: vi.fn(),
    preparePreview: async () => undefined,
    readDuration: () => 10,
    repository: { getByTriggerLineHash: () => null },
    resolveStoredPath: (path) => path,
    runClipOperation: (_id, operation) => operation(),
    updateClip: (clip, update) => ({ ...clip, ...update }),
  };
  service = new ReplayClipCreationService(dependencies);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(directory, { force: true, recursive: true });
});

describe("Replay clip preview recovery", () => {
  it("releases capture protection and clears pending state if persistence fails", async () => {
    dependencies.persistAndPublish = () => {
      throw new Error("Replay storage unavailable");
    };

    await expect(service.execute(deathEvent)).rejects.toThrow(
      "Replay storage unavailable",
    );

    const clipId = overlay.setReplaySaveActive.mock.calls[0]![0];
    expect(overlay.setReplaySaveActive.mock.calls).toEqual([
      [clipId, true],
      [clipId, false],
    ]);
    service.showPendingClipPreviewOverlay();
    expect(overlay.showClipPreviewOverlay).not.toHaveBeenCalled();
    expect(saveReplay).not.toHaveBeenCalled();
  });

  it("preserves the newer pending preview when an older queued creation completes", async () => {
    let releaseOlderOperation!: () => void;
    const olderOperationGate = new Promise<void>((resolve) => {
      releaseOlderOperation = resolve;
    });
    let releaseNewerSave!: () => void;
    const newerSaveGate = new Promise<void>((resolve) => {
      releaseNewerSave = resolve;
    });
    let operationCount = 0;
    dependencies.runClipOperation = async (_id, operation) => {
      if (operationCount++ === 0) {
        await olderOperationGate;
      }
      return operation();
    };
    const savedReplay = { error: null, ok: true, path: replayPath };
    saveReplay
      .mockImplementationOnce(async () => {
        await newerSaveGate;
        return savedReplay;
      })
      .mockResolvedValueOnce(savedReplay);
    overlay.showClipPreviewOverlay.mockResolvedValueOnce(false);

    const olderSaving = service.execute({
      ...deathEvent,
      kind: "manual",
      lineHash: "older-manual",
    });
    const newerSaving = service.execute(deathEvent);
    const newerClipId = overlay.setReplaySaveActive.mock.calls[1]![0];
    releaseOlderOperation();
    expect((await olderSaving)?.status).toBe("ready");

    service.showPendingClipPreviewOverlay();
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledTimes(2);
    expect(overlay.showClipPreviewOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: newerClipId, status: "saving_replay" }),
    );

    releaseNewerSave();
    expect((await newerSaving)?.id).toBe(newerClipId);
  });

  it("permits a retry when the preview closed before it could be presented", async () => {
    overlay.showClipPreviewOverlay.mockResolvedValueOnce(false);
    const clip = createReplayClip();
    service.showClipPreviewOverlay(clip);
    await Promise.resolve();
    await Promise.resolve();
    service.showClipPreviewOverlay(clip);
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledTimes(2);
  });

  it("coalesces in-flight requests but allows another attempt after rejection", async () => {
    let rejectOpening!: (error: Error) => void;
    const opening = new Promise<boolean>((_resolve, reject) => {
      rejectOpening = reject;
    });
    overlay.showClipPreviewOverlay.mockReturnValueOnce(opening);
    const clip = createReplayClip();
    service.showClipPreviewOverlay(clip);
    service.showClipPreviewOverlay(clip);
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledOnce();
    rejectOpening(new Error("renderer load failed"));
    await expect(opening).rejects.toThrow("renderer load failed");
    await Promise.resolve();
    service.showClipPreviewOverlay(clip);
    service.showClipPreviewOverlay(clip);
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledTimes(2);
  });

  it("retries a failed early preview after saving completes", async () => {
    const failedOpening = Promise.reject(new Error("renderer load failed"));
    overlay.showClipPreviewOverlay.mockReturnValueOnce(failedOpening);
    const saving = service.execute(deathEvent);
    await expect(failedOpening).rejects.toThrow("renderer load failed");
    await Promise.resolve();
    releaseSave();
    const clip = await saving;
    expect(clip?.status).toBe("ready");
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledTimes(2);
    expect(overlay.showClipPreviewOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    );
    expect(overlay.showReplayStatusOverlay).not.toHaveBeenCalled();
  });

  it("retries when the first preview fails after saving has already completed", async () => {
    let rejectOpening!: (error: Error) => void;
    const opening = new Promise<boolean>((_resolve, reject) => {
      rejectOpening = reject;
    });
    overlay.showClipPreviewOverlay.mockReturnValueOnce(opening);
    const saving = service.execute(deathEvent);
    releaseSave();
    expect((await saving)?.status).toBe("ready");
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledOnce();
    rejectOpening(new Error("renderer load failed"));
    await expect(opening).rejects.toThrow("renderer load failed");
    await Promise.resolve();
    expect(overlay.showClipPreviewOverlay).toHaveBeenCalledTimes(2);
    expect(overlay.showClipPreviewOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready" }),
    );
  });

  it.each([true, false])(
    "defers unsafe previews without interrupting a save (success: %s)",
    async (success) => {
      overlay.setReplaySaveActive.mockImplementation((_id, active) => {
        if (active) {
          throw new Error("capture protection unavailable");
        }
      });
      if (!success) {
        saveReplay.mockImplementationOnce(async () => {
          return { error: "save failed", ok: false, path: null };
        });
      }
      const saving = service.execute(deathEvent);
      expect(saveReplay).toHaveBeenCalledOnce();
      service.showPendingClipPreviewOverlay();
      expect(overlay.showClipPreviewOverlay).not.toHaveBeenCalled();
      releaseSave();
      const clip = await saving;
      expect(clip?.status).toBe(success ? "ready" : "failed");
      if (success) {
        expect(overlay.showClipPreviewOverlay).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ status: "ready" }),
        );
        expect(
          overlay.setReplaySaveActive.mock.invocationCallOrder.at(-1),
        ).toBeLessThan(
          overlay.showClipPreviewOverlay.mock.invocationCallOrder[0]!,
        );
      } else {
        expect(overlay.showClipPreviewOverlay).not.toHaveBeenCalled();
      }
      expect(overlay.setReplaySaveActive).toHaveBeenLastCalledWith(
        clip?.id,
        false,
      );
      expect(overlay.showReplayStatusOverlay).not.toHaveBeenCalled();
    },
  );
});
