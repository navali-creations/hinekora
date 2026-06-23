import type { DragEndEvent } from "@dnd-kit/react";
import { describe, expect, it } from "vitest";

import { resolveDropTimelineSeconds } from "./EditorDragDropProvider.utils";

function createDropEvent(input: {
  clientX?: number;
  left?: number;
  width?: number;
}): DragEndEvent {
  return {
    canceled: false,
    nativeEvent:
      input.clientX === undefined
        ? undefined
        : ({ clientX: input.clientX } as Event & { clientX: number }),
    operation: {
      target:
        input.left === undefined || input.width === undefined
          ? null
          : {
              shape: {
                boundingRectangle: {
                  left: input.left,
                  width: input.width,
                },
              },
            },
    },
    suspend: () => ({ resume: () => undefined }),
  } as unknown as DragEndEvent;
}

describe("EditorDragDropProvider utils", () => {
  it("resolves dropped client positions into timeline seconds", () => {
    expect(
      resolveDropTimelineSeconds({
        durationSeconds: 10,
        event: createDropEvent({ clientX: 50, left: 0, width: 100 }),
      }),
    ).toBe(6.25);
    expect(
      resolveDropTimelineSeconds({
        durationSeconds: 24,
        event: createDropEvent({ clientX: 100, left: 0, width: 200 }),
      }),
    ).toBe(15);
  });

  it("falls back to the timeline end when bounds are missing", () => {
    expect(
      resolveDropTimelineSeconds({
        durationSeconds: 12,
        event: createDropEvent({}),
      }),
    ).toBe(12);
  });
});
