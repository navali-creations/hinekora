import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

import { createReplayClipView } from "~/main/test/factories/replayClip";

import { type AppSettings, createDefaultSettings } from "~/types";
import { getClipPreviewTrimRail } from "../ClipPreviewOverlay.test-utils";
import { ClipPreviewOverlayPage } from "./ClipPreviewOverlay.page";

interface ClipPreviewOverlayStoreMocks {
  copyClip: Mock;
  getClip: Mock;
  hideClipPreview: Mock;
  onOperationProgress: Mock;
  onStatusChanged: Mock;
  openClip: Mock;
  openEditorClip: Mock;
  requestFullscreen: Mock;
  revealClip: Mock;
  settingsValue: AppSettings | null;
  updateClip: Mock;
  updateSettings: Mock;
  useSettingsShallow: Mock;
  writeClipPreviewEvent: Mock;
}

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

async function renderPage(): Promise<void> {
  await act(async () => {
    root.render(<ClipPreviewOverlayPage />);
  });
}

async function flushPromises(): Promise<void> {
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

function emitOperationProgress(
  progress: Parameters<
    Parameters<typeof window.electron.replayClips.onOperationProgress>[0]
  >[0],
): void {
  operationProgressListener?.(progress);
}

function emitStatusChanged(
  clip: Parameters<
    Parameters<typeof window.electron.replayClips.onStatusChanged>[0]
  >[0],
): void {
  statusChangedListener?.(clip);
}

function setupClipPreviewOverlayTestHarness(
  storeMocks: ClipPreviewOverlayStoreMocks,
): void {
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
    const clip = createReplayClipView({
      id: "clip-1",
      durationSeconds: 10,
      fileName: "2026-07-08 01-18-40.mp4",
      hasMediaFile: true,
    });
    storeMocks.getClip.mockResolvedValue({
      clip,
      durationSeconds: 10,
      mediaUrl: "hinekora-media://replay-clip/main-provided-clip-1",
    });
    operationProgressListener = null;
    statusChangedListener = null;
    storeMocks.onOperationProgress.mockImplementation(
      (
        listener: Parameters<
          typeof window.electron.replayClips.onOperationProgress
        >[0],
      ) => {
        operationProgressListener = listener;

        return vi.fn();
      },
    );
    storeMocks.onStatusChanged.mockImplementation(
      (
        listener: Parameters<
          typeof window.electron.replayClips.onStatusChanged
        >[0],
      ) => {
        statusChangedListener = listener;

        return vi.fn();
      },
    );
    storeMocks.hideClipPreview.mockResolvedValue(undefined);
    storeMocks.copyClip.mockResolvedValue({ error: null, ok: true });
    storeMocks.openEditorClip.mockResolvedValue(undefined);
    storeMocks.openClip.mockResolvedValue(undefined);
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
    storeMocks.useSettingsShallow.mockImplementation(
      (
        selector: (state: {
          update: Mock;
          value: AppSettings | null;
        }) => unknown,
      ) =>
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
        diagLog: {
          writeClipPreviewEvent: storeMocks.writeClipPreviewEvent,
        },
        mainWindow: {
          openEditorClip: storeMocks.openEditorClip,
          openClip: storeMocks.openClip,
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
}

export type { ClipPreviewOverlayStoreMocks };
export {
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
};
