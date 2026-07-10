import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { createReplayClipView } from "~/main/test/factories/replayClip";

import type { AppSettings } from "~/types";
import { dispatchClipPreviewPointerEvent } from "../ClipPreviewOverlay.test-utils";

const storeMocks = vi.hoisted(() => ({
  hideClipPreview: vi.fn(),
  copyClip: vi.fn(),
  getClip: vi.fn(),
  onOperationProgress: vi.fn(),
  onStatusChanged: vi.fn(),
  openEditorClip: vi.fn(),
  openClip: vi.fn(),
  revealClip: vi.fn(),
  requestFullscreen: vi.fn(),
  settingsValue: null as AppSettings | null,
  trackEvent: vi.fn(),
  updateClip: vi.fn(),
  updateSettings: vi.fn(),
  useSettingsShallow: vi.fn(),
  writeClipPreviewEvent: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: storeMocks.trackEvent,
}));

vi.mock("~/renderer/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/renderer/store")>();

  return {
    ...actual,
    useSettingsShallow: storeMocks.useSettingsShallow,
  };
});

import {
  container,
  createDeferred,
  emitOperationProgress,
  emitStatusChanged,
  findButton,
  findButtonByLabel,
  flushPromises,
  markPreviewVideoReady,
  renderPage,
  setupClipPreviewOverlayTestHarness,
  setupTrimRail,
} from "./ClipPreviewOverlay.test-harness";

setupClipPreviewOverlayTestHarness(storeMocks);

describe("ClipPreviewOverlayPage", () => {
  it("routes overlay actions to fullscreen, editor, save, clipboard, and explorer handlers", async () => {
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();

    expect(video.getAttribute("src")).toBe(
      "hinekora-media://replay-clip/main-provided-clip-1?v=0",
    );

    expect(container.textContent).toContain("Continue in editor");
    expect(container.textContent).toContain("Save clip");
    expect(container.textContent).toContain("Copy to clipboard");
    expect(container.textContent).toContain(
      "Manual Replays and Death Clips are available on the Clips page.",
    );
    expect(container.textContent).not.toContain("Open");
    expect(container.textContent).not.toContain("Folder");
    expect(findButtonByLabel("Show clip in Explorer").dataset.tip).toBe(
      "Show in Explorer",
    );
    expect(findButtonByLabel("Open clip fullscreen").dataset.tip).toBe(
      "Fullscreen",
    );
    expect(findButtonByLabel("Mute replay").dataset.tip).toBe("Mute");
    expect(findButton("Continue in editor").className).not.toContain(
      "btn-primary",
    );

    const input = container.querySelector("input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected clip name input");
    }
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("2026-07-08 01-18-40");
    expect(container.textContent).toContain(".mp4");
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(input, "Renamed clip");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("Renamed clip");
    await act(async () => {
      valueSetter?.call(input, "Renamed clip.mp4");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("Renamed clip");

    await act(async () => {
      findButtonByLabel("Open clip fullscreen").click();
    });
    await act(async () => {
      findButtonByLabel("Show clip in Explorer").click();
    });
    await act(async () => {
      findButtonByLabel("Mute replay").click();
    });
    expect(container.textContent).toContain(
      "Muted clips are exported without audio.",
    );
    expect(findButtonByLabel("Unmute replay").dataset.tip).toBe("Unmute");
    await act(async () => {
      findButtonByLabel("Dismiss clips page info").click();
    });
    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      clipPreviewInfoAlertDismissed: true,
    });
    await renderPage();
    expect(container.textContent).not.toContain(
      "Manual Replays and Death Clips are available on the Clips page.",
    );
    await act(async () => {
      findButton("Continue in editor").click();
    });
    await act(async () => {
      findButton("Save clip").click();
    });
    vi.useFakeTimers();
    await act(async () => {
      findButton("Copy to clipboard").click();
    });
    await flushPromises();

    expect(storeMocks.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(storeMocks.revealClip).toHaveBeenCalledWith("clip-1");
    expect(storeMocks.copyClip).toHaveBeenCalledWith(
      expect.objectContaining({ id: "clip-1" }),
    );
    expect(storeMocks.updateClip).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "clip-1",
        name: "Renamed clip",
      }),
    );
    expect(container.textContent).toContain("Copied successfully!");
    expect(container.textContent).not.toContain("Clip copied to clipboard.");
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(container.textContent).toContain("Copy to clipboard");
    expect(storeMocks.openEditorClip).toHaveBeenCalledWith("clip-1", {
      title: "Renamed clip",
      trim: { inSeconds: 0, outSeconds: 10 },
    });
    expect(storeMocks.hideClipPreview).toHaveBeenCalledTimes(1);
    expect(storeMocks.trackEvent).toHaveBeenCalledWith(
      "clip-preview-overlay-edit-opened",
    );
  });

  it("saves a mute-only edit", async () => {
    await renderPage();
    await flushPromises();
    await markPreviewVideoReady();

    expect(findButton("Save clip").disabled).toBe(true);
    await act(async () => {
      findButtonByLabel("Mute replay").click();
    });
    expect(findButton("Save clip").disabled).toBe(false);

    await act(async () => {
      findButton("Save clip").click();
    });
    await flushPromises();

    expect(storeMocks.updateClip).toHaveBeenCalledWith({
      id: "clip-1",
      muteAudio: true,
      operationRequestId: expect.any(String),
    });
  });

  it("shows media errors and retries with a fresh media URL", async () => {
    await renderPage();
    await flushPromises();
    const video = container.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Expected preview video");
    }
    Object.defineProperty(video, "error", {
      configurable: true,
      value: { code: 3, message: "Decode failed" },
    });

    await act(async () => {
      video.dispatchEvent(new Event("error", { bubbles: true }));
    });

    expect(container.textContent).toContain("Preview unavailable");
    expect(container.textContent).toContain("Decode failed");
    expect(container.querySelector("video")).toBeNull();

    await act(async () => {
      findButton("Retry").click();
    });

    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "hinekora-media://replay-clip/main-provided-clip-1?v=1",
    );
  });

  it("labels pending save and copy actions as processing", async () => {
    await renderPage();
    await flushPromises();
    await markPreviewVideoReady();

    const input = container.querySelector("input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected clip name input");
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(input, "Renamed clip");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const saveDeferred =
      createDeferred<Awaited<ReturnType<typeof storeMocks.updateClip>>>();
    storeMocks.updateClip.mockReturnValueOnce(saveDeferred.promise);
    await act(async () => {
      findButton("Save clip").click();
    });
    const saveRequestId =
      storeMocks.updateClip.mock.calls[0]?.[0].operationRequestId;
    expect(container.textContent).toContain("Processing...");
    expect(input.disabled).toBe(true);
    expect(findButton("Copy to clipboard").disabled).toBe(true);
    expect(findButtonByLabel("Mute replay").disabled).toBe(true);
    expect(findButtonByLabel("Close replay preview").disabled).toBe(true);
    expect(findButton("Continue in editor").disabled).toBe(true);
    expect(findButtonByLabel("Trim clip start").disabled).toBe(true);
    await act(async () => {
      emitOperationProgress({
        operationRequestId: saveRequestId,
        progress: 0.42,
      });
    });
    expect(
      findButton("Processing...").style.getPropertyValue(
        "--clip-processing-progress",
      ),
    ).toBe("42%");
    await act(async () => {
      saveDeferred.resolve({
        detail: {
          clip: createReplayClipView({
            id: "clip-1",
            durationSeconds: 10,
            fileName: "Renamed clip.mp4",
            hasMediaFile: true,
          }),
          durationSeconds: 10,
          mediaUrl: "hinekora-media://replay-clip/clip-1",
        },
        error: null,
        ok: true,
      });
    });
    await flushPromises();

    const copyDeferred =
      createDeferred<Awaited<ReturnType<typeof storeMocks.copyClip>>>();
    storeMocks.copyClip.mockReturnValueOnce(copyDeferred.promise);
    await act(async () => {
      findButton("Copy to clipboard").click();
    });
    const copyRequestId =
      storeMocks.copyClip.mock.calls.at(-1)?.[0].operationRequestId;
    expect(container.textContent).toContain("Processing...");
    expect(input.disabled).toBe(true);
    expect(findButtonByLabel("Mute replay").disabled).toBe(true);
    expect(findButtonByLabel("Close replay preview").disabled).toBe(true);
    await act(async () => {
      emitOperationProgress({
        operationRequestId: copyRequestId,
        progress: 0.66,
      });
    });
    expect(
      findButton("Processing...").style.getPropertyValue(
        "--clip-processing-progress",
      ),
    ).toBe("66%");
    await act(async () => {
      copyDeferred.resolve({ error: null, ok: true });
    });
    await flushPromises();
  });

  it("shows a disabled preparing preview until the replay file is ready", async () => {
    const pendingClip = createReplayClipView({
      id: "clip-1",
      durationSeconds: null,
      fileName: null,
      hasMediaFile: false,
      status: "saving_replay",
      targetDurationSeconds: 10,
    });
    const readyClip = createReplayClipView({
      id: "clip-1",
      durationSeconds: 10,
      fileName: "2026-07-08 01-18-40.mp4",
      hasMediaFile: true,
      status: "ready",
      targetDurationSeconds: 10,
    });
    storeMocks.getClip.mockReset();
    storeMocks.getClip
      .mockResolvedValueOnce({
        clip: pendingClip,
        durationSeconds: null,
        mediaUrl: null,
      })
      .mockResolvedValueOnce({
        clip: readyClip,
        durationSeconds: 10,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      });

    await renderPage();
    await flushPromises();

    expect(container.textContent).toContain("Preparing Replay");
    expect(container.textContent).toContain("Saving replay file");
    expect(container.textContent).toContain("Preparing preview");
    expect(container.querySelector("video")).toBeNull();
    expect(findButton("Continue in editor").disabled).toBe(true);
    expect(findButton("Copy to clipboard").disabled).toBe(true);
    expect(findButtonByLabel("Trim clip start").disabled).toBe(true);

    await act(async () => {
      emitStatusChanged(readyClip);
    });
    await flushPromises();

    expect(container.textContent).toContain("Replay Ready");
    expect(container.querySelector("video")).toBeInstanceOf(HTMLVideoElement);
    expect(findButtonByLabel("Trim clip start").disabled).toBe(true);

    await markPreviewVideoReady();

    expect(findButton("Continue in editor").disabled).toBe(false);
    expect(findButton("Copy to clipboard").disabled).toBe(false);
    expect(findButtonByLabel("Trim clip start").disabled).toBe(false);
  });

  it("passes the selected trim range to clipboard copy and save actions", async () => {
    await renderPage();
    await flushPromises();
    await markPreviewVideoReady();

    const rail = setupTrimRail();
    const startHandle = findButtonByLabel("Trim clip start");
    await act(async () => {
      dispatchClipPreviewPointerEvent(startHandle, "pointerdown", {
        clientX: 0,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", { clientX: 20 });
      dispatchClipPreviewPointerEvent(rail, "pointerup", { clientX: 20 });
    });

    await act(async () => {
      findButton("Copy to clipboard").click();
    });
    await flushPromises();
    expect(storeMocks.copyClip).toHaveBeenCalledWith({
      id: "clip-1",
      operationRequestId: expect.any(String),
      trim: { inSeconds: 2, outSeconds: 10 },
    });

    await act(async () => {
      findButton("Save clip").click();
    });
    await flushPromises();
    expect(storeMocks.updateClip).toHaveBeenCalledWith({
      id: "clip-1",
      operationRequestId: expect.any(String),
      trim: { inSeconds: 2, outSeconds: 10 },
    });
  });

  it("allows opening the saved clip in editor after a successful save", async () => {
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    const input = container.querySelector("input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected clip name input");
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(input, "Renamed clip");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const saveDeferred =
      createDeferred<Awaited<ReturnType<typeof storeMocks.updateClip>>>();
    storeMocks.updateClip.mockReturnValueOnce(saveDeferred.promise);

    expect(container.textContent).not.toContain("Open in Clips view");

    await act(async () => {
      findButton("Save clip").click();
    });

    await act(async () => {
      saveDeferred.resolve({
        detail: {
          clip: createReplayClipView({
            id: "clip-1",
            durationSeconds: 10,
            fileName: "Renamed clip.mp4",
            hasMediaFile: true,
          }),
          durationSeconds: 10,
          mediaUrl: "hinekora-media://replay-clip/main-provided-clip-1",
        },
        error: null,
        ok: true,
      });
    });
    await flushPromises();

    expect(container.textContent).toContain("Open in Clips view");
    expect(video.currentTime).toBe(0);

    await act(async () => {
      const openSavedClipLink = Array.from(
        container.querySelectorAll("a"),
      ).find((element) => element.textContent?.includes("Open in Clips view"));
      if (!openSavedClipLink) {
        throw new Error("Expected open saved clip link");
      }

      openSavedClipLink.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(storeMocks.openClip).toHaveBeenCalledWith("clip-1");
  });
});
