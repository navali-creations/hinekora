import { afterEach, describe, expect, it, vi } from "vitest";

import { createClipThumbnails } from "./useEditorClipThumbnails.utils";

describe("createClipThumbnails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("cleans up the video element when thumbnail loading times out", async () => {
    vi.useFakeTimers();
    const originalCreateElement = document.createElement.bind(document);
    const video = createMockVideoElement();
    const createElementSpy = vi.spyOn(document, "createElement") as unknown as {
      mockImplementation: (
        implementation: (tagName: string) => HTMLElement,
      ) => void;
    };
    createElementSpy.mockImplementation((tagName) => {
      if (tagName === "video") {
        return video;
      }

      return originalCreateElement(tagName);
    });

    const thumbnails = createClipThumbnails(
      {
        count: 1,
        inSeconds: 0,
        mediaUrl: "hinekora-media://clip/1",
        outSeconds: 1,
      },
      () => false,
    );
    const assertion = expect(thumbnails).rejects.toThrow(
      "loadedmetadata timed out",
    );
    await vi.advanceTimersByTimeAsync(3_000);

    await assertion;
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
    expect(video.load).toHaveBeenCalledTimes(1);
  });
});

function createMockVideoElement(): HTMLVideoElement {
  const video = new EventTarget() as HTMLVideoElement;
  Object.assign(video, {
    crossOrigin: "",
    currentTime: 0,
    duration: 1,
    load: vi.fn(),
    muted: false,
    playsInline: false,
    preload: "",
    readyState: 0,
    removeAttribute: vi.fn(),
    videoHeight: 90,
    videoWidth: 160,
  });
  Object.defineProperty(video, "src", {
    configurable: true,
    value: "",
    writable: true,
  });

  return video;
}
