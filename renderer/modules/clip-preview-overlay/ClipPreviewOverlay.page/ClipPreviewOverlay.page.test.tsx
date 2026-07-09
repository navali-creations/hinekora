import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import { type AppSettings, createDefaultSettings } from "~/types";
import {
  dispatchClipPreviewPointerEvent,
  getClipPreviewTrimRail,
} from "../ClipPreviewOverlay.test-utils";

const storeMocks = vi.hoisted(() => ({
  hideClipPreview: vi.fn(),
  copyClip: vi.fn(),
  getClip: vi.fn(),
  onOperationProgress: vi.fn(),
  onStatusChanged: vi.fn(),
  openEditorClip: vi.fn(),
  revealClip: vi.fn(),
  requestFullscreen: vi.fn(),
  settingsValue: null as AppSettings | null,
  trackEvent: vi.fn(),
  updateClip: vi.fn(),
  updateSettings: vi.fn(),
  useSettingsShallow: vi.fn(),
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

import { ClipPreviewOverlayPage } from "./ClipPreviewOverlay.page";

let container: HTMLDivElement;
let root: Root;
let originalFastSeekDescriptor: PropertyDescriptor | undefined;
let operationProgressListener:
  | Parameters<typeof window.electron.replayClips.onOperationProgress>[0]
  | null = null;
let statusChangedListener:
  | Parameters<typeof window.electron.replayClips.onStatusChanged>[0]
  | null = null;

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find ${label} button`);
  }

  return button;
}

function findButtonByLabel(label: string): HTMLButtonElement {
  const button = container.querySelector(`[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find ${label} button`);
  }

  return button;
}

async function renderPage() {
  await act(async () => {
    root.render(<ClipPreviewOverlayPage />);
  });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

async function markPreviewVideoReady(): Promise<HTMLVideoElement> {
  const video = container.querySelector("video");
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error("Expected preview video");
  }

  Object.defineProperty(video, "readyState", {
    configurable: true,
    value: HTMLMediaElement.HAVE_ENOUGH_DATA,
  });
  await act(async () => {
    video.dispatchEvent(new Event("canplay", { bubbles: true }));
    video.dispatchEvent(new Event("canplaythrough", { bubbles: true }));
  });

  return video;
}

function setupTrimRail(): HTMLElement {
  return getClipPreviewTrimRail(container);
}

describe("ClipPreviewOverlayPage", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    originalFastSeekDescriptor = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      "fastSeek",
    );
    window.location.hash = "#/clip-preview-overlay?clipId=clip-1";
    const clip = createReplayClip({
      id: "clip-1",
      durationSeconds: 10,
      processedClipPath: "C:\\clips\\2026-07-08 01-18-40.mp4",
    });
    storeMocks.getClip.mockResolvedValue({
      clip,
      durationSeconds: 10,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
    });
    operationProgressListener = null;
    statusChangedListener = null;
    storeMocks.onOperationProgress.mockImplementation((listener) => {
      operationProgressListener = listener;

      return vi.fn();
    });
    storeMocks.onStatusChanged.mockImplementation((listener) => {
      statusChangedListener = listener;

      return vi.fn();
    });
    storeMocks.hideClipPreview.mockResolvedValue(undefined);
    storeMocks.copyClip.mockResolvedValue({ error: null, ok: true });
    storeMocks.openEditorClip.mockResolvedValue(undefined);
    storeMocks.revealClip.mockResolvedValue({ error: null, ok: true });
    storeMocks.requestFullscreen.mockResolvedValue(undefined);
    storeMocks.settingsValue = createDefaultSettings();
    storeMocks.updateSettings.mockImplementation(
      (input: Partial<AppSettings>) => {
        storeMocks.settingsValue = {
          ...storeMocks.settingsValue,
          ...input,
        } as AppSettings;

        return Promise.resolve();
      },
    );
    storeMocks.updateClip.mockResolvedValue({
      detail: {
        clip: createReplayClip({
          id: "clip-1",
          durationSeconds: 10,
          processedClipPath: "C:\\clips\\Renamed clip.mp4",
        }),
        durationSeconds: 10,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      },
      error: null,
      ok: true,
    });
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        update: storeMocks.updateSettings,
        value: storeMocks.settingsValue,
      }),
    );
    Object.defineProperty(HTMLVideoElement.prototype, "requestFullscreen", {
      configurable: true,
      value: storeMocks.requestFullscreen,
    });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        mainWindow: {
          openEditorClip: storeMocks.openEditorClip,
        },
        overlayWindows: {
          hideClipPreview: storeMocks.hideClipPreview,
        },
        replayClips: {
          copy: storeMocks.copyClip,
          get: storeMocks.getClip,
          onOperationProgress: storeMocks.onOperationProgress,
          onStatusChanged: storeMocks.onStatusChanged,
          reveal: storeMocks.revealClip,
          update: storeMocks.updateClip,
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    operationProgressListener = null;
    statusChangedListener = null;
    window.location.hash = "";
    if (originalFastSeekDescriptor) {
      Object.defineProperty(
        HTMLVideoElement.prototype,
        "fastSeek",
        originalFastSeekDescriptor,
      );
    } else {
      Reflect.deleteProperty(HTMLVideoElement.prototype, "fastSeek");
    }
    originalFastSeekDescriptor = undefined;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("routes overlay actions to fullscreen, editor, save, clipboard, and explorer handlers", async () => {
    await renderPage();
    await flushPromises();
    await markPreviewVideoReady();

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
    expect(findButton("Continue in editor").disabled).toBe(true);
    expect(findButtonByLabel("Trim clip start").disabled).toBe(true);
    await act(async () => {
      operationProgressListener?.({
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
          clip: createReplayClip({
            id: "clip-1",
            durationSeconds: 10,
            processedClipPath: "C:\\clips\\Renamed clip.mp4",
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
    await act(async () => {
      operationProgressListener?.({
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
    const pendingClip = createReplayClip({
      id: "clip-1",
      durationSeconds: null,
      originalObsPath: null,
      processedClipPath: null,
      status: "saving_replay",
      targetDurationSeconds: 10,
    });
    const readyClip = createReplayClip({
      id: "clip-1",
      durationSeconds: 10,
      processedClipPath: "C:\\clips\\2026-07-08 01-18-40.mp4",
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
      statusChangedListener?.(readyClip);
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

  it("scrubs the paused video frame while dragging trim handles", async () => {
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallback = callback;

        return 1;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const fastSeek = vi.fn(function fastSeek(
      this: HTMLVideoElement,
      seconds: number,
    ) {
      this.currentTime = seconds;
    });
    Object.defineProperty(HTMLVideoElement.prototype, "fastSeek", {
      configurable: true,
      value: fastSeek,
    });
    await renderPage();
    await flushPromises();
    await markPreviewVideoReady();

    const rail = setupTrimRail();
    const endHandle = findButtonByLabel("Trim clip end");
    await act(async () => {
      dispatchClipPreviewPointerEvent(endHandle, "pointerdown", {
        clientX: 80,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", { clientX: 70 });
    });
    await act(async () => {
      frameCallback?.(0);
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(fastSeek).toHaveBeenLastCalledWith(7);
  });

  it("keeps playback running when seeking with a rail marker click", async () => {
    const fastSeek = vi.fn(function fastSeek(
      this: HTMLVideoElement,
      seconds: number,
    ) {
      this.currentTime = seconds;
    });
    Object.defineProperty(HTMLVideoElement.prototype, "fastSeek", {
      configurable: true,
      value: fastSeek,
    });
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    const pause = vi.fn();
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: pause,
    });
    Object.defineProperty(video, "paused", {
      configurable: true,
      value: false,
    });
    await act(async () => {
      video.dispatchEvent(new Event("play", { bubbles: true }));
    });

    await act(async () => {
      dispatchClipPreviewPointerEvent(setupTrimRail(), "pointerdown", {
        clientX: 60,
      });
    });

    expect(pause).not.toHaveBeenCalled();
    expect(fastSeek).toHaveBeenLastCalledWith(6);
  });

  it("keeps paused seeks at the trim end instead of rewinding to trim start", async () => {
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();

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
      dispatchClipPreviewPointerEvent(rail, "pointerdown", { clientX: 100 });
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(video.currentTime).toBe(0);
    expect(container.textContent).toContain("10.00 / 10.00");
  });
});
