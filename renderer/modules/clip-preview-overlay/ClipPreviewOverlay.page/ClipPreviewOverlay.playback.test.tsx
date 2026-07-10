import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { useBoundStore } from "~/renderer/store";

import type { AppSettings } from "~/types";
import { dispatchClipPreviewPointerEvent } from "../ClipPreviewOverlay.test-utils";
import {
  container,
  findButtonByLabel,
  flushPromises,
  markPreviewVideoReady,
  renderPage,
  setupClipPreviewOverlayTestHarness,
  setupTrimRail,
} from "./ClipPreviewOverlay.test-harness";

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

setupClipPreviewOverlayTestHarness(storeMocks);

describe("ClipPreviewOverlayPage playback", () => {
  it("updates timer and playhead only when a video frame is presented", async () => {
    let videoFrameCallback: VideoFrameRequestCallback | null = null;
    let videoFrameCallbackId = 0;
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    const playheadLayer = Array.from(
      setupTrimRail().querySelectorAll("span"),
    ).find((element) => element.style.transform.startsWith("translate3d"));
    if (!(playheadLayer instanceof HTMLSpanElement)) {
      throw new Error("Expected trim playhead");
    }
    const initialPlayheadTransform = playheadLayer.style.transform;
    const requestVideoFrameCallback = vi.fn(
      (callback: VideoFrameRequestCallback) => {
        videoFrameCallback = callback;
        videoFrameCallbackId += 1;

        return videoFrameCallbackId;
      },
    );
    const cancelVideoFrameCallback = vi.fn();
    Object.defineProperties(video, {
      cancelVideoFrameCallback: {
        configurable: true,
        value: cancelVideoFrameCallback,
      },
      requestVideoFrameCallback: {
        configurable: true,
        value: requestVideoFrameCallback,
      },
      paused: {
        configurable: true,
        value: false,
      },
    });

    await act(async () => {
      video.dispatchEvent(new Event("play", { bubbles: true }));
      video.dispatchEvent(new Event("play", { bubbles: true }));
    });

    expect(requestVideoFrameCallback).toHaveBeenCalledTimes(1);
    expect(cancelVideoFrameCallback).not.toHaveBeenCalled();

    video.currentTime = 3.25;
    await act(async () => {
      videoFrameCallback?.(0, {
        mediaTime: 3.25,
      } as VideoFrameCallbackMetadata);
    });

    expect(container.textContent).toContain("3.25 / 10.00");
    expect(playheadLayer.style.transform).not.toBe(initialPlayheadTransform);
    expect(playheadLayer.style.transform).toContain("32.5%");
    expect(requestVideoFrameCallback).toHaveBeenCalledTimes(2);

    await act(async () => {
      useBoundStore.getState().clipPreviewOverlay.setMuted(true);
    });
    expect(container.textContent).toContain("3.25 / 10.00");
    expect(playheadLayer.style.transform).toContain("32.5%");

    video.currentTime = 4;
    await act(async () => {
      videoFrameCallback?.(17, {
        mediaTime: 4,
      } as VideoFrameCallbackMetadata);
    });
    expect(container.textContent).toContain("4.00 / 10.00");
    expect(playheadLayer.style.transform).toContain("40%");
    expect(requestVideoFrameCallback).toHaveBeenCalledTimes(3);

    await act(async () => {
      video.dispatchEvent(new Event("pause", { bubbles: true }));
    });

    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(3);
  });

  it("records media events and sampled playback health diagnostics", async () => {
    vi.useFakeTimers();
    let videoFrameCallback: VideoFrameRequestCallback | null = null;
    let videoFrameCallbackId = 0;
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    Object.defineProperties(video, {
      duration: { configurable: true, value: 10 },
      getVideoPlaybackQuality: {
        configurable: true,
        value: () => ({
          corruptedVideoFrames: 0,
          creationTime: 0,
          droppedVideoFrames: 2,
          totalVideoFrames: 60,
        }),
      },
      paused: { configurable: true, value: false },
      cancelVideoFrameCallback: {
        configurable: true,
        value: vi.fn(),
      },
      requestVideoFrameCallback: {
        configurable: true,
        value: vi.fn((callback: VideoFrameRequestCallback) => {
          videoFrameCallback = callback;
          videoFrameCallbackId += 1;

          return videoFrameCallbackId;
        }),
      },
      videoHeight: { configurable: true, value: 1080 },
      videoWidth: { configurable: true, value: 1920 },
    });

    await act(async () => {
      video.dispatchEvent(new Event("play", { bubbles: true }));
    });
    await act(async () => {
      videoFrameCallback?.(0, {
        mediaTime: 0,
      } as VideoFrameCallbackMetadata);
      video.currentTime = 1;
      videoFrameCallback?.(17, {
        mediaTime: 1,
      } as VideoFrameCallbackMetadata);
      vi.advanceTimersByTime(1_000);
    });

    expect(storeMocks.writeClipPreviewEvent).toHaveBeenCalledWith({
      event: "media-event",
      fields: expect.objectContaining({
        clipId: "clip-1",
        mediaEvent: "play",
        videoHeight: 1080,
        videoWidth: 1920,
      }),
    });
    expect(
      storeMocks.writeClipPreviewEvent.mock.calls.filter(
        ([input]) =>
          input.event === "media-event" && input.fields?.mediaEvent === "play",
      ),
    ).toHaveLength(1);
    expect(storeMocks.writeClipPreviewEvent).toHaveBeenCalledWith({
      event: "playback-health",
      fields: expect.objectContaining({
        frameCallbacks: 2,
        clipId: "clip-1",
        currentTime: 1,
        droppedFrames: 2,
        maxFrameCallbackGapMs: 17,
        presentationUpdates: 2,
        stateIsPlaying: true,
        totalFrames: 60,
        videoHeight: 1080,
        videoWidth: 1920,
      }),
    });
  });

  it("does not install playback diagnostics unless explicitly enabled", async () => {
    window.location.hash = "#/clip-preview-overlay?clipId=clip-1&diagnostics=0";

    await renderPage();
    await flushPromises();

    expect(storeMocks.writeClipPreviewEvent).not.toHaveBeenCalled();
  });

  it("scrubs the paused video frame while dragging trim handles", async () => {
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

    const rail = setupTrimRail();
    const endHandle = findButtonByLabel("Trim clip end");
    await act(async () => {
      dispatchClipPreviewPointerEvent(endHandle, "pointerdown", {
        clientX: 80,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", { clientX: 70 });
    });

    expect(fastSeek).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(7);
    expect(container.textContent).toContain("7.00 / 10.00");
  });

  it("keeps the timer and marker at a non-zero trimmed start", async () => {
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    const rail = setupTrimRail();
    const startHandle = findButtonByLabel("Trim clip start");
    const playheadLayer = Array.from(rail.querySelectorAll("span")).find(
      (element) => element.style.transform.startsWith("translate3d"),
    );
    if (!(playheadLayer instanceof HTMLSpanElement)) {
      throw new Error("Expected trim playhead");
    }

    await act(async () => {
      dispatchClipPreviewPointerEvent(startHandle, "pointerdown", {
        clientX: 0,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", { clientX: 20 });
      dispatchClipPreviewPointerEvent(rail, "pointerup", { clientX: 20 });
      video.dispatchEvent(new Event("seeked", { bubbles: true }));
      video.dispatchEvent(new Event("canplay", { bubbles: true }));
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(video.currentTime).toBe(2);
    expect(container.textContent).toContain("2.00 / 10.00");
    expect(playheadLayer.style.transform).toContain("20%");
  });

  it("scrubs the paused video frame while moving the selected trim range", async () => {
    vi.useFakeTimers();
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    await act(async () => {
      useBoundStore
        .getState()
        .clipPreviewOverlay.setTrim({ inSeconds: 2, outSeconds: 5 });
    });

    await flushPromises();
    const updatedRail = setupTrimRail();
    const selection = findButtonByLabel("Move selected trim range");
    await act(async () => {
      dispatchClipPreviewPointerEvent(selection, "pointerdown", {
        clientX: 40,
      });
      vi.advanceTimersByTime(250);
      dispatchClipPreviewPointerEvent(updatedRail, "pointermove", {
        clientX: 60,
      });
    });

    expect(video.currentTime).toBe(4);
    expect(container.textContent).toContain("4.00 / 10.00");
  });

  it("pauses and resumes playback around a rail marker seek", async () => {
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
    let paused = false;
    const pause = vi.fn(() => {
      paused = true;
      video.dispatchEvent(new Event("pause", { bubbles: true }));
    });
    const play = vi.fn(() => {
      paused = false;
      video.dispatchEvent(new Event("play", { bubbles: true }));
      return Promise.resolve();
    });
    Object.defineProperties(video, {
      pause: { configurable: true, value: pause },
      paused: { configurable: true, get: () => paused },
      play: { configurable: true, value: play },
    });
    await act(async () => {
      video.dispatchEvent(new Event("play", { bubbles: true }));
    });

    await act(async () => {
      dispatchClipPreviewPointerEvent(setupTrimRail(), "pointerdown", {
        clientX: 60,
      });
    });

    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
    expect(fastSeek).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(6);
    expect(container.textContent).toContain("6.00 / 10.00");

    await act(async () => {
      video.dispatchEvent(new Event("seeked", { bubbles: true }));
    });
    expect(play).toHaveBeenCalledTimes(1);
    expect(paused).toBe(false);
  });

  it("keeps a pending marker stable without reissuing an unsettled seek", async () => {
    let currentTime = 0;
    const currentTimeWrites: number[] = [];
    let videoFrameCallback: VideoFrameRequestCallback | null = null;
    await renderPage();
    await flushPromises();
    const video = await markPreviewVideoReady();
    let paused = false;
    const pause = vi.fn(() => {
      paused = true;
      video.dispatchEvent(new Event("pause", { bubbles: true }));
    });
    const play = vi.fn(() => {
      paused = false;
      video.dispatchEvent(new Event("play", { bubbles: true }));
      return Promise.resolve();
    });
    Object.defineProperties(video, {
      currentTime: {
        configurable: true,
        get: () => currentTime,
        set: (seconds: number) => {
          currentTime = seconds;
          currentTimeWrites.push(seconds);
        },
      },
      paused: {
        configurable: true,
        get: () => paused,
      },
      pause: { configurable: true, value: pause },
      play: { configurable: true, value: play },
      requestVideoFrameCallback: {
        configurable: true,
        value: vi.fn((callback: VideoFrameRequestCallback) => {
          videoFrameCallback = callback;
          return 1;
        }),
      },
      cancelVideoFrameCallback: {
        configurable: true,
        value: vi.fn(),
      },
    });
    await act(async () => {
      video.dispatchEvent(new Event("play", { bubbles: true }));
      dispatchClipPreviewPointerEvent(setupTrimRail(), "pointerdown", {
        clientX: 60,
      });
    });

    currentTime = 0;
    await act(async () => {
      video.dispatchEvent(new Event("seeking", { bubbles: true }));
      video.dispatchEvent(new Event("canplay", { bubbles: true }));
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(currentTimeWrites).toEqual([6]);
    expect(container.textContent).toContain("6.00 / 10.00");
    expect(play).not.toHaveBeenCalled();

    currentTime = 6;
    await act(async () => {
      video.dispatchEvent(new Event("seeked", { bubbles: true }));
    });
    expect(play).toHaveBeenCalledTimes(1);

    await act(async () => {
      videoFrameCallback?.(17, {
        mediaTime: 6,
      } as VideoFrameCallbackMetadata);
      videoFrameCallback?.(34, {
        mediaTime: 7,
      } as VideoFrameCallbackMetadata);
    });
    expect(container.textContent).toContain("7.00 / 10.00");
  });

  it("scrubs paused rail seeks at the trim end instead of rewinding to trim start", async () => {
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

    expect(video.currentTime).toBe(10);
    expect(container.textContent).toContain("10.00 / 10.00");
  });
});
