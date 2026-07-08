import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import { type AppSettings, createDefaultSettings } from "~/types";

const storeMocks = vi.hoisted(() => ({
  hideClipPreview: vi.fn(),
  copyClip: vi.fn(),
  getClip: vi.fn(),
  openClip: vi.fn(),
  openEditorClip: vi.fn(),
  revealClip: vi.fn(),
  settingsValue: null as AppSettings | null,
  trackEvent: vi.fn(),
  updateClip: vi.fn(),
  updateSettings: vi.fn(),
  useReplayClipsShallow: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: storeMocks.trackEvent,
}));

vi.mock("~/renderer/store", () => ({
  useReplayClipsShallow: storeMocks.useReplayClipsShallow,
  useSettingsShallow: storeMocks.useSettingsShallow,
}));

import { ClipPreviewOverlayPage } from "./ClipPreviewOverlay.page";

let container: HTMLDivElement;
let root: Root;

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

function dispatchPointerEvent(
  target: Element,
  type: string,
  input: { clientX: number; pointerId?: number },
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: input.clientX },
    pointerId: { value: input.pointerId ?? 1 },
  });
  target.dispatchEvent(event);
}

function setupTrimRail(): HTMLElement {
  const rail = container.querySelector('[aria-label="Clip trim timeline"]');
  if (!(rail instanceof HTMLElement)) {
    throw new Error("Expected trim timeline");
  }

  rail.getBoundingClientRect = () =>
    ({
      bottom: 36,
      height: 36,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  return rail;
}

describe("ClipPreviewOverlayPage", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
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
    storeMocks.hideClipPreview.mockResolvedValue(undefined);
    storeMocks.copyClip.mockResolvedValue({ error: null, ok: true });
    storeMocks.openClip.mockResolvedValue(undefined);
    storeMocks.openEditorClip.mockResolvedValue(undefined);
    storeMocks.revealClip.mockResolvedValue(undefined);
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
    storeMocks.useReplayClipsShallow.mockImplementation((selector) =>
      selector({
        activeClip: null,
        copyClip: storeMocks.copyClip,
        items: [clip],
        openClip: storeMocks.openClip,
        revealClip: storeMocks.revealClip,
        updateClip: storeMocks.updateClip,
      }),
    );
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        update: storeMocks.updateSettings,
        value: storeMocks.settingsValue,
      }),
    );

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
          get: storeMocks.getClip,
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.location.hash = "";
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("routes overlay actions to fullscreen, editor, save, clipboard, and explorer handlers", async () => {
    await renderPage();
    await flushPromises();

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

    expect(storeMocks.openClip).toHaveBeenCalledWith("clip-1");
    expect(storeMocks.revealClip).toHaveBeenCalledWith("clip-1");
    expect(storeMocks.copyClip).toHaveBeenCalledWith({ id: "clip-1" });
    expect(storeMocks.updateClip).toHaveBeenCalledWith({
      id: "clip-1",
      name: "Renamed clip",
    });
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
    expect(container.textContent).toContain("Processing...");
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
    expect(container.textContent).toContain("Processing...");
    await act(async () => {
      copyDeferred.resolve({ error: null, ok: true });
    });
    await flushPromises();
  });

  it("passes the selected trim range to clipboard copy and save actions", async () => {
    await renderPage();
    await flushPromises();

    const rail = setupTrimRail();
    const startHandle = findButtonByLabel("Trim clip start");
    await act(async () => {
      dispatchPointerEvent(startHandle, "pointerdown", { clientX: 0 });
      dispatchPointerEvent(rail, "pointermove", { clientX: 20 });
      dispatchPointerEvent(rail, "pointerup", { clientX: 20 });
    });

    await act(async () => {
      findButton("Copy to clipboard").click();
    });
    await flushPromises();
    expect(storeMocks.copyClip).toHaveBeenCalledWith({
      id: "clip-1",
      trim: { inSeconds: 2, outSeconds: 10 },
    });

    await act(async () => {
      findButton("Save clip").click();
    });
    await flushPromises();
    expect(storeMocks.updateClip).toHaveBeenCalledWith({
      id: "clip-1",
      trim: { inSeconds: 2, outSeconds: 10 },
    });
  });
});
