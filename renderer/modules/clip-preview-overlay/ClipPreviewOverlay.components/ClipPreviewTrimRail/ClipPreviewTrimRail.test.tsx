import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { ClipPreviewTrimRail } from "./ClipPreviewTrimRail";

let container: HTMLDivElement;
let root: Root;

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
        playbackSeconds={0}
        trim={trim}
        onSeek={onSeek}
        onTrimChange={onTrimChange}
      />,
    );
  });

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
      dispatchPointerEvent(rail, "pointerdown", { clientX: 10 });
      dispatchPointerEvent(selection, "pointerdown", { clientX: 40 });
      dispatchPointerEvent(rail, "pointerup", { clientX: 40 });
      dispatchPointerEvent(rail, "pointerdown", { clientX: 80 });
    });

    expect(onSeek).toHaveBeenNthCalledWith(1, 2);
    expect(onSeek).toHaveBeenNthCalledWith(2, 4);
    expect(onSeek).toHaveBeenNthCalledWith(3, 5);
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
    const onTrimChange = vi.fn();
    const onSeek = vi.fn();
    const rail = await renderRail(onTrimChange, undefined, onSeek);
    const selection = container.querySelector(
      '[aria-label="Move selected trim range"]',
    );
    if (!(selection instanceof HTMLElement)) {
      throw new Error("Expected trim selection");
    }

    await act(async () => {
      dispatchPointerEvent(selection, "pointerdown", { clientX: 30 });
      dispatchPointerEvent(rail, "pointermove", { clientX: 60 });
    });

    expect(onSeek).toHaveBeenLastCalledWith(5);
    expect(onTrimChange).toHaveBeenLastCalledWith({
      inSeconds: 5,
      outSeconds: 8,
    });
  });
});
