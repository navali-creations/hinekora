import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaFrameStepKeyboardShortcuts } from "./useMediaFrameStepKeyboardShortcuts";
import {
  resolveMediaFrameStepDirection,
  resolveMediaFrameStepSeconds,
} from "./useMediaFrameStepKeyboardShortcuts.utils";

function FrameStepHarness({
  enabled = true,
  framesPerSecond = 60,
  getPlaybackSeconds,
  onStep,
}: {
  enabled?: boolean;
  framesPerSecond?: number | null;
  getPlaybackSeconds: () => number;
  onStep: (seconds: number) => void;
}) {
  useMediaFrameStepKeyboardShortcuts({
    enabled,
    focusRegionSelector: '[data-frame-step-region="true"]',
    framesPerSecond,
    getPlaybackSeconds,
    onStep,
  });

  return (
    <div>
      <button data-frame-step-region="true" type="button">
        Timeline
      </button>
      <button data-outside="true" type="button">
        Outside
      </button>
      <input aria-label="Title" />
      <div role="dialog">
        <button type="button">Dialog action</button>
      </div>
      <div role="menu">
        <button type="button">Menu action</button>
      </div>
      <div contentEditable>Editable</div>
    </div>
  );
}

function CustomFrameStepHarness({
  onStep,
  resolveFrameStepSeconds,
}: {
  onStep: (seconds: number) => void;
  resolveFrameStepSeconds: (
    seconds: number,
    direction: -1 | 1,
  ) => number | null;
}) {
  useMediaFrameStepKeyboardShortcuts({
    enabled: true,
    getPlaybackSeconds: () => 2.01,
    onStep,
    resolveFrameStepSeconds,
  });

  return <button type="button">Timeline</button>;
}

describe("useMediaFrameStepKeyboardShortcuts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("steps to adjacent frames relative to a media origin", () => {
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 2.013,
        direction: 1,
        framesPerSecond: 60,
        originSeconds: 1,
      }),
    ).toBeCloseTo(2 + 1 / 60);
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 0.000_6,
        direction: 1,
        framesPerSecond: 960,
      }),
    ).toBeCloseTo(1 / 960);
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 2.013,
        direction: -1,
        framesPerSecond: 60,
        originSeconds: 1,
      }),
    ).toBeCloseTo(2 - 1 / 60);
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 2,
        direction: 1,
        framesPerSecond: 60,
        originSeconds: 1,
      }),
    ).toBeCloseTo(2 + 1 / 60);
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 2.02,
        direction: -1,
        framesPerSecond: 60,
        originSeconds: 1,
      }),
    ).toBeCloseTo(2);
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 2,
        direction: 1,
        framesPerSecond: 0,
      }),
    ).toBe(2);
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: Number.NaN,
        direction: 1,
        framesPerSecond: 60,
      }),
    ).toBeNaN();
    expect(
      resolveMediaFrameStepSeconds({
        currentSeconds: 2,
        direction: 1,
        framesPerSecond: 60,
        originSeconds: Number.NaN,
      }),
    ).toBeCloseTo(2 + 1 / 60);
  });

  it("recognizes only unmodified comma and period shortcuts", () => {
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { key: "," }),
      ),
    ).toBe(-1);
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { key: "." }),
      ),
    ).toBe(1);
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { key: "x" }),
      ),
    ).toBeNull();
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { ctrlKey: true, key: "." }),
      ),
    ).toBeNull();
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { altKey: true, key: "." }),
      ),
    ).toBeNull();
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { metaKey: true, key: "." }),
      ),
    ).toBeNull();
    expect(
      resolveMediaFrameStepDirection(
        new KeyboardEvent("keydown", { shiftKey: true, key: "." }),
      ),
    ).toBeNull();
    const preventedEvent = new KeyboardEvent("keydown", {
      cancelable: true,
      key: ".",
    });
    preventedEvent.preventDefault();
    expect(resolveMediaFrameStepDirection(preventedEvent)).toBeNull();
    const composingEvent = new KeyboardEvent("keydown", { key: "." });
    Object.defineProperty(composingEvent, "isComposing", { value: true });
    expect(resolveMediaFrameStepDirection(composingEvent)).toBeNull();
  });

  it("handles shortcuts only while focus is within the requested region", () => {
    const onStep = vi.fn();
    act(() => {
      root.render(
        <FrameStepHarness getPlaybackSeconds={() => 2} onStep={onStep} />,
      );
    });
    const allowed = container.querySelector<HTMLButtonElement>(
      "[data-frame-step-region='true']",
    );
    const outside = container.querySelector<HTMLButtonElement>(
      "[data-outside='true']",
    );
    const title = container.querySelector<HTMLInputElement>("input");
    const dialogButton = container.querySelector<HTMLButtonElement>(
      '[role="dialog"] button',
    );
    const menuButton = container.querySelector<HTMLButtonElement>(
      '[role="menu"] button',
    );
    const editable = container.querySelector<HTMLElement>("[contenteditable]");
    if (
      !allowed ||
      !outside ||
      !title ||
      !dialogButton ||
      !menuButton ||
      !editable
    ) {
      throw new Error("Expected shortcut test targets");
    }

    const forwardEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: ".",
    });
    act(() => allowed.dispatchEvent(forwardEvent));

    expect(forwardEvent.defaultPrevented).toBe(true);
    expect(onStep).toHaveBeenCalledWith(2 + 1 / 60);

    for (const target of [outside, title, dialogButton, menuButton, editable]) {
      act(() => {
        target.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "," }),
        );
      });
    }

    expect(onStep).toHaveBeenCalledTimes(1);

    act(() => {
      allowed.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "." }),
      );
    });
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(allowed);

    act(() => outside.focus());
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "." }),
      );
    });
    expect(onStep).toHaveBeenCalledTimes(2);

    act(() => {
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "." }),
      );
    });
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it("does not listen while disabled and removes its listener on unmount", () => {
    const onStep = vi.fn();
    act(() => {
      root.render(
        <FrameStepHarness
          enabled={false}
          getPlaybackSeconds={() => 2}
          onStep={onStep}
        />,
      );
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "." }));
    });
    expect(onStep).not.toHaveBeenCalled();

    act(() => {
      root.render(
        <FrameStepHarness getPlaybackSeconds={() => 2} onStep={onStep} />,
      );
    });
    act(() => root.unmount());
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "." }));
    });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("leaves legacy media without frame metadata alone", () => {
    const onStep = vi.fn();
    act(() => {
      root.render(
        <FrameStepHarness
          framesPerSecond={null}
          getPlaybackSeconds={() => 2.01}
          onStep={onStep}
        />,
      );
    });
    const timeline = container.querySelector<HTMLButtonElement>(
      "[data-frame-step-region='true']",
    );
    if (!timeline) {
      throw new Error("Expected timeline target");
    }
    const legacyEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: ".",
    });
    act(() => timeline.dispatchEvent(legacyEvent));

    expect(legacyEvent.defaultPrevented).toBe(false);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("allows a caller to resolve a direction-aware frame target", () => {
    const onStep = vi.fn();
    const resolveFrameStepSeconds = vi
      .fn<(seconds: number, direction: -1 | 1) => number | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(4.5);
    act(() => {
      root.render(
        <CustomFrameStepHarness
          onStep={onStep}
          resolveFrameStepSeconds={resolveFrameStepSeconds}
        />,
      );
    });
    const timeline = container.querySelector("button");
    if (!timeline) {
      throw new Error("Expected timeline target");
    }
    const ignoredEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: ",",
    });
    const handledEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: ".",
    });

    act(() => timeline.dispatchEvent(ignoredEvent));
    act(() => timeline.dispatchEvent(handledEvent));

    expect(resolveFrameStepSeconds).toHaveBeenNthCalledWith(1, 2.01, -1);
    expect(resolveFrameStepSeconds).toHaveBeenNthCalledWith(2, 2.01, 1);
    expect(ignoredEvent.defaultPrevented).toBe(false);
    expect(handledEvent.defaultPrevented).toBe(true);
    expect(onStep).toHaveBeenCalledWith(4.5);
  });
});
