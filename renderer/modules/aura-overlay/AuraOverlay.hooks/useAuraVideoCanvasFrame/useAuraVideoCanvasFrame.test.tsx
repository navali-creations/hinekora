import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuraVideoCanvasFrame } from "./useAuraVideoCanvasFrame";

interface TestGeometry {
  id: string;
}

interface TestAuraVideoCanvasFrameProps {
  drawFrame: (input: {
    canvas: HTMLCanvasElement;
    geometry: TestGeometry;
    video: HTMLVideoElement;
  }) => void;
  shouldDrawFrame: (nowMs: number, lastDrawMs: number | null) => boolean;
}

const testGeometry: TestGeometry = { id: "geometry-1" };
const requestVideoFrameCallbackDescriptor = Object.getOwnPropertyDescriptor(
  HTMLVideoElement.prototype,
  "requestVideoFrameCallback",
);
const cancelVideoFrameCallbackDescriptor = Object.getOwnPropertyDescriptor(
  HTMLVideoElement.prototype,
  "cancelVideoFrameCallback",
);

function restoreVideoFrameCallbackProperty(
  propertyName: "requestVideoFrameCallback" | "cancelVideoFrameCallback",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(HTMLVideoElement.prototype, propertyName, descriptor);
    return;
  }

  delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>)[
    propertyName
  ];
}

function TestAuraVideoCanvasFrame({
  drawFrame,
  shouldDrawFrame,
}: TestAuraVideoCanvasFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useAuraVideoCanvasFrame({
    canvasRef,
    drawFrame,
    fallbackFrameIntervalMs: 10,
    geometry: testGeometry,
    shouldDrawFrame,
    videoRef,
  });

  return (
    <>
      <canvas ref={canvasRef} />
      <video ref={videoRef} />
    </>
  );
}

describe("useAuraVideoCanvasFrame", () => {
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    root = null;
    document.body.replaceChildren();
    restoreVideoFrameCallbackProperty(
      "requestVideoFrameCallback",
      requestVideoFrameCallbackDescriptor,
    );
    restoreVideoFrameCallbackProperty(
      "cancelVideoFrameCallback",
      cancelVideoFrameCallbackDescriptor,
    );
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses the frame gate for fallback timed canvas redraws", async () => {
    vi.useFakeTimers();
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      {
        configurable: true,
        value: undefined,
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback",
      {
        configurable: true,
        value: undefined,
      },
    );
    const drawFrame = vi.fn();
    const shouldDrawFrame = vi.fn(
      (nowMs: number, lastDrawMs: number | null) =>
        lastDrawMs === null || nowMs - lastDrawMs >= 20,
    );
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <TestAuraVideoCanvasFrame
          drawFrame={drawFrame}
          shouldDrawFrame={shouldDrawFrame}
        />,
      );
      await Promise.resolve();
    });

    expect(drawFrame).toHaveBeenCalledTimes(1);
    expect(shouldDrawFrame).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(shouldDrawFrame).toHaveBeenCalledTimes(1);
    expect(drawFrame).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(shouldDrawFrame).toHaveBeenCalledTimes(2);
    expect(drawFrame).toHaveBeenCalledTimes(2);
    expect(drawFrame).toHaveBeenLastCalledWith({
      canvas: expect.any(HTMLCanvasElement),
      geometry: testGeometry,
      video: expect.any(HTMLVideoElement),
    });
  });
});
