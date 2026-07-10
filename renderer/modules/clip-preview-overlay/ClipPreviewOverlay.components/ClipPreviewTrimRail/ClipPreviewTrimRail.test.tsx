import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchClipPreviewPointerEvent,
  getClipPreviewTrimRail,
} from "../../ClipPreviewOverlay.test-utils";
import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { ClipPreviewTrimRail } from "./ClipPreviewTrimRail";

let container: HTMLDivElement;
let root: Root;

function findLabel(text: string): HTMLSpanElement {
  const label = Array.from(container.querySelectorAll("span")).find(
    (item) => item.textContent === text,
  );
  if (!(label instanceof HTMLSpanElement)) {
    throw new Error(`Expected ${text} label`);
  }

  return label;
}

async function renderRail(
  onTrimChange = vi.fn(),
  trim: ClipPreviewTrimRange = { inSeconds: 2, outSeconds: 5 },
  onSeek = vi.fn(),
) {
  await act(async () => {
    root.render(
      <ClipPreviewTrimRail
        disabled={false}
        durationSeconds={10}
        trim={trim}
        onSeek={onSeek}
        onTrimChange={onTrimChange}
      />,
    );
  });

  return getClipPreviewTrimRail(container);
}

describe("ClipPreviewTrimRail", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders a lightweight rail without thumbnails", async () => {
    await renderRail();

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("clamps outside rail seeks to trim edges and seeks inside the trim", async () => {
    const onSeek = vi.fn();
    const rail = await renderRail(vi.fn(), undefined, onSeek);
    const selection = container.querySelector(
      '[aria-label="Move selected trim range"]',
    );
    if (!(selection instanceof HTMLElement)) {
      throw new Error("Expected trim selection");
    }

    await act(async () => {
      dispatchClipPreviewPointerEvent(rail, "pointerdown", { clientX: 10 });
      dispatchClipPreviewPointerEvent(selection, "pointerdown", {
        clientX: 40,
      });
      dispatchClipPreviewPointerEvent(rail, "pointerup", { clientX: 40 });
      dispatchClipPreviewPointerEvent(rail, "pointerdown", { clientX: 80 });
    });

    expect(onSeek).toHaveBeenNthCalledWith(1, 2, {
      preservePlayback: true,
    });
    expect(onSeek).toHaveBeenNthCalledWith(2, 4, {
      preservePlayback: true,
    });
    expect(onSeek).toHaveBeenNthCalledWith(3, 5, {
      preservePlayback: true,
    });
  });

  it("attaches timers to trim edges until the range is tight", async () => {
    await renderRail();

    expect(findLabel("02.00").style.left).toBe("20%");
    expect(findLabel("05.00").style.left).toBe("50%");
    expect(findLabel("03.00").style.left).toBe("35%");

    await renderRail(vi.fn(), { inSeconds: 2, outSeconds: 3 });

    expect(findLabel("02.00").style.left).toBe("");
    expect(findLabel("03.00").style.left).toBe("");
    expect(findLabel("01.00").style.left).toBe("25%");
  });

  it("moves the selected trim range as a fixed duration", async () => {
    vi.useFakeTimers();
    const onTrimChange = vi.fn();
    const rail = await renderRail(onTrimChange);
    const selection = container.querySelector(
      '[aria-label="Move selected trim range"]',
    );
    if (!(selection instanceof HTMLElement)) {
      throw new Error("Expected trim selection");
    }

    await act(async () => {
      dispatchClipPreviewPointerEvent(selection, "pointerdown", {
        clientX: 30,
        timeStamp: 0,
      });
      vi.advanceTimersByTime(250);
      dispatchClipPreviewPointerEvent(rail, "pointermove", {
        clientX: 60,
        timeStamp: 250,
      });
    });

    expect(onTrimChange).toHaveBeenLastCalledWith(
      {
        inSeconds: 5,
        outSeconds: 8,
      },
      { previewSeconds: 5 },
    );
  });

  it("waits for a hold before moving the selected trim range", async () => {
    vi.useFakeTimers();
    const onTrimChange = vi.fn();
    const rail = await renderRail(onTrimChange);
    const selection = container.querySelector(
      '[aria-label="Move selected trim range"]',
    );
    if (!(selection instanceof HTMLElement)) {
      throw new Error("Expected trim selection");
    }

    await act(async () => {
      dispatchClipPreviewPointerEvent(selection, "pointerdown", {
        clientX: 30,
        timeStamp: 0,
      });
      vi.advanceTimersByTime(249);
      dispatchClipPreviewPointerEvent(rail, "pointermove", {
        clientX: 60,
        timeStamp: 249,
      });
    });
    expect(onTrimChange).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      dispatchClipPreviewPointerEvent(rail, "pointermove", {
        clientX: 60,
        timeStamp: 250,
      });
    });

    expect(onTrimChange).toHaveBeenLastCalledWith(
      {
        inSeconds: 5,
        outSeconds: 8,
      },
      { previewSeconds: 5 },
    );
  });

  it("previews the active trim edge while dragging handles", async () => {
    const onTrimChange = vi.fn();
    const rail = await renderRail(onTrimChange);
    const endHandle = container.querySelector('[aria-label="Trim clip end"]');
    if (!(endHandle instanceof HTMLElement)) {
      throw new Error("Expected trim end handle");
    }

    await act(async () => {
      dispatchClipPreviewPointerEvent(endHandle, "pointerdown", {
        clientX: 80,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", { clientX: 70 });
    });

    expect(onTrimChange).toHaveBeenLastCalledWith(
      {
        inSeconds: 2,
        outSeconds: 7,
      },
      { previewSeconds: 7 },
    );
  });

  it("commits a throttled final handle position on pointer up", async () => {
    const onTrimChange = vi.fn();
    const rail = await renderRail(onTrimChange);
    const endHandle = container.querySelector('[aria-label="Trim clip end"]');
    if (!(endHandle instanceof HTMLElement)) {
      throw new Error("Expected trim end handle");
    }

    await act(async () => {
      dispatchClipPreviewPointerEvent(endHandle, "pointerdown", {
        clientX: 50,
        timeStamp: 100,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", {
        clientX: 70,
        timeStamp: 120,
      });
      dispatchClipPreviewPointerEvent(rail, "pointermove", {
        clientX: 80,
        timeStamp: 125,
      });
      dispatchClipPreviewPointerEvent(rail, "pointerup", {
        clientX: 80,
        timeStamp: 126,
      });
    });

    expect(onTrimChange).toHaveBeenLastCalledWith(
      {
        inSeconds: 2,
        outSeconds: 8,
      },
      { previewSeconds: 8 },
    );
  });
});
