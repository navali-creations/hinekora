import type { DragEndEvent } from "@dnd-kit/react";

import {
  calculateExpandableTimelineDuration,
  resolveTimelineSecondsFromClientX,
} from "../../Editor.utils/Editor.utils";

function resolveDropTimelineSeconds(input: {
  durationSeconds: number;
  event: DragEndEvent;
}): number {
  const bounds = input.event.operation.target?.shape?.boundingRectangle;
  const nativeEvent = input.event.nativeEvent;
  if (!bounds || !hasClientX(nativeEvent)) {
    return input.durationSeconds;
  }

  return resolveTimelineSecondsFromClientX({
    clientX: nativeEvent.clientX,
    timelineLeft: bounds.left,
    timelineWidth: bounds.width,
    visibleDurationSeconds: calculateExpandableTimelineDuration({
      projectDurationSeconds: input.durationSeconds,
    }),
  });
}

function hasClientX(event: Event | undefined): event is Event & {
  clientX: number;
} {
  return typeof event === "object" && event !== null && "clientX" in event;
}

export { resolveDropTimelineSeconds };
