import { resolveTimelineSecondsFromClientX } from "../../Editor.utils/Editor.utils";

interface ResolveEditorTimelineHoverSecondsInput {
  clientX: number;
  labelColumnWidth: number;
  target: EventTarget | null;
  timelineGrid: HTMLElement | null;
  visibleDurationSeconds: number;
}

function resolveEditorTimelineHoverSeconds({
  clientX,
  labelColumnWidth,
  target,
  timelineGrid,
  visibleDurationSeconds,
}: ResolveEditorTimelineHoverSecondsInput): number | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const trimHandle = target.closest<HTMLElement>("[data-trim-edge]");
  if (trimHandle) {
    return resolveTrimEdgeHoverSeconds(trimHandle);
  }

  if (
    target.closest(
      "[data-clip-body], [data-playhead-handle], [data-gap-delete-button]",
    ) ||
    !target.closest("[data-timeline-marker-zone], [data-timeline-gap-zone]")
  ) {
    return null;
  }

  if (!timelineGrid) {
    return null;
  }

  const bounds = timelineGrid.getBoundingClientRect();
  const timelineLeft = bounds.left + labelColumnWidth;
  if (clientX < timelineLeft || clientX > bounds.right) {
    return null;
  }

  return resolveTimelineSecondsFromClientX({
    clientX,
    timelineLeft,
    timelineWidth: bounds.width - labelColumnWidth,
    visibleDurationSeconds,
  });
}

function resolveTrimEdgeHoverSeconds(trimHandle: HTMLElement): number | null {
  const clipStartSeconds = Number(trimHandle.dataset.clipStartSeconds);
  const clipDurationSeconds = Number(trimHandle.dataset.clipDurationSeconds);
  const trimEdge = trimHandle.dataset.trimEdge;
  if (
    !Number.isFinite(clipStartSeconds) ||
    !Number.isFinite(clipDurationSeconds) ||
    (trimEdge !== "start" && trimEdge !== "end")
  ) {
    return null;
  }

  return trimEdge === "start"
    ? clipStartSeconds
    : clipStartSeconds + clipDurationSeconds;
}

export { resolveEditorTimelineHoverSeconds, resolveTrimEdgeHoverSeconds };
