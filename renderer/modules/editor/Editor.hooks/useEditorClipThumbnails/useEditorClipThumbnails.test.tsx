import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const thumbnailUtilsMocks = vi.hoisted(() => ({
  createClipThumbnails: vi.fn(),
  createThumbnailCacheKey: vi.fn((input: Record<string, unknown>) =>
    JSON.stringify(input),
  ),
}));

vi.mock("./useEditorClipThumbnails.utils", () => thumbnailUtilsMocks);

import { useEditorClipThumbnails } from "./useEditorClipThumbnails";

interface ThumbnailHarnessProps {
  mediaUrl: string | null;
  onRender?: (thumbnails: string[]) => void;
  widthPixels?: number;
}

let container: HTMLDivElement;
let isRootMounted = false;
let root: Root;

function ThumbnailHarness({
  mediaUrl,
  onRender,
  widthPixels = 192,
}: ThumbnailHarnessProps) {
  const thumbnails = useEditorClipThumbnails({
    durationSeconds: 10,
    inSeconds: 0,
    mediaUrl,
    outSeconds: 10,
    widthPixels,
  });
  onRender?.(thumbnails);

  return (
    <div>
      {thumbnails.map((thumbnail) => (
        <span data-thumbnail={thumbnail} key={thumbnail} />
      ))}
    </div>
  );
}

async function renderHarness(props: ThumbnailHarnessProps) {
  await act(async () => {
    root.render(<ThumbnailHarness {...props} />);
  });
  isRootMounted = true;
}

describe("useEditorClipThumbnails", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    isRootMounted = false;
  });

  afterEach(() => {
    if (isRootMounted) {
      root.unmount();
    }
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("delays thumbnail creation, caps count, and reuses cached thumbnails", async () => {
    thumbnailUtilsMocks.createClipThumbnails.mockResolvedValue([
      "thumb-a",
      "thumb-b",
      "thumb-c",
    ]);

    await renderHarness({
      mediaUrl: "hinekora-media://clip/cache",
      widthPixels: 1_000,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(thumbnailUtilsMocks.createClipThumbnails).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(thumbnailUtilsMocks.createClipThumbnails).toHaveBeenCalledWith(
      {
        count: 8,
        inSeconds: 0,
        mediaUrl: "hinekora-media://clip/cache",
        outSeconds: 10,
      },
      expect.any(Function),
    );
    expect(container.querySelectorAll("[data-thumbnail]")).toHaveLength(3);

    await renderHarness({ mediaUrl: null, widthPixels: 1_000 });
    expect(container.querySelectorAll("[data-thumbnail]")).toHaveLength(0);

    await renderHarness({
      mediaUrl: "hinekora-media://clip/cache",
      widthPixels: 1_000,
    });

    expect(thumbnailUtilsMocks.createClipThumbnails).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("[data-thumbnail]")).toHaveLength(3);
  });

  it("does not create thumbnails when unmounted before the delay", async () => {
    thumbnailUtilsMocks.createClipThumbnails.mockResolvedValue(["thumb-a"]);

    await renderHarness({ mediaUrl: "hinekora-media://clip/cancel" });
    await act(async () => {
      root.unmount();
      isRootMounted = false;
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(thumbnailUtilsMocks.createClipThumbnails).not.toHaveBeenCalled();
  });

  it("does not reschedule thumbnail work for width changes inside the same bucket", async () => {
    thumbnailUtilsMocks.createClipThumbnails.mockResolvedValue(["thumb-a"]);

    await renderHarness({
      mediaUrl: "hinekora-media://clip/width-bucket",
      widthPixels: 100,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(thumbnailUtilsMocks.createClipThumbnails).toHaveBeenCalledTimes(1);
    expect(thumbnailUtilsMocks.createThumbnailCacheKey).toHaveBeenCalledTimes(
      1,
    );

    await renderHarness({
      mediaUrl: "hinekora-media://clip/width-bucket",
      widthPixels: 180,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(thumbnailUtilsMocks.createClipThumbnails).toHaveBeenCalledTimes(1);
    expect(thumbnailUtilsMocks.createThumbnailCacheKey).toHaveBeenCalledTimes(
      1,
    );
  });

  it("passes cancellation into in-flight thumbnail creation", async () => {
    let isCancelled: (() => boolean) | null = null;
    let resolveThumbnails: (thumbnails: string[]) => void = () => undefined;
    thumbnailUtilsMocks.createClipThumbnails.mockImplementationOnce(
      (_input: unknown, nextIsCancelled: () => boolean) =>
        new Promise((resolve) => {
          isCancelled = nextIsCancelled;
          resolveThumbnails = resolve;
        }),
    );
    const getIsCancelled = () => {
      if (!isCancelled) {
        throw new Error("Expected thumbnail cancellation callback");
      }

      return isCancelled;
    };

    await renderHarness({ mediaUrl: "hinekora-media://clip/in-flight" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(getIsCancelled()()).toBe(false);

    await act(async () => {
      root.unmount();
      isRootMounted = false;
    });

    expect(getIsCancelled()()).toBe(true);

    await act(async () => {
      resolveThumbnails(["thumb-cancelled"]);
      await Promise.resolve();
    });

    expect(container.querySelectorAll("[data-thumbnail]")).toHaveLength(0);
  });

  it("serializes thumbnail generation work", async () => {
    let resolveFirst: (thumbnails: string[]) => void = () => undefined;
    thumbnailUtilsMocks.createClipThumbnails
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(["second"]);

    await act(async () => {
      root.render(
        <>
          <ThumbnailHarness mediaUrl="hinekora-media://clip/first" />
          <ThumbnailHarness mediaUrl="hinekora-media://clip/second" />
        </>,
      );
    });
    isRootMounted = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(thumbnailUtilsMocks.createClipThumbnails).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(["first"]);
      await Promise.resolve();
    });

    expect(thumbnailUtilsMocks.createClipThumbnails).toHaveBeenCalledTimes(2);
  });
});
