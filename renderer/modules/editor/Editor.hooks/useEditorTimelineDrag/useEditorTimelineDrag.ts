import { type PointerEvent, useEffect, useRef, useState } from "react";

import { useEditorShallow } from "~/renderer/store";

import { resolveTimelineSecondsFromClientX } from "../../Editor.utils/Editor.utils";
import {
  resolveClipDragPreview,
  type TimelineClipDragPreview,
  type TimelineDragState,
} from "./useEditorTimelineDrag.utils";

interface UseEditorTimelineDragInput {
  labelColumnWidth: number;
  visibleDurationSeconds: number;
}

const clipMoveActivationPixels = 4;

function useEditorTimelineDrag({
  labelColumnWidth,
  visibleDurationSeconds,
}: UseEditorTimelineDragInput) {
  const timelineGridRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<TimelineDragState | null>(null);
  const scheduledTimelineActionRef = useRef<(() => void) | null>(null);
  const scheduledTimelineActionFrameRef = useRef<number | null>(null);
  const scheduledClipDragPreviewRef = useRef<TimelineClipDragPreview | null>(
    null,
  );
  const scheduledClipDragPreviewFrameRef = useRef<number | null>(null);
  const [clipDragPreview, setClipDragPreview] =
    useState<TimelineClipDragPreview | null>(null);
  const {
    beginHistoryTransaction,
    commitHistoryTransaction,
    moveTimelineClip,
    project,
    selectTimelineClip,
    setPlaybackSeconds,
    trimTimelineClipEdge,
  } = useEditorShallow((editor) => ({
    beginHistoryTransaction: editor.beginHistoryTransaction,
    commitHistoryTransaction: editor.commitHistoryTransaction,
    moveTimelineClip: editor.moveTimelineClip,
    project: editor.project,
    selectTimelineClip: editor.selectTimelineClip,
    setPlaybackSeconds: editor.setPlaybackSeconds,
    trimTimelineClipEdge: editor.trimTimelineClipEdge,
  }));
  const timelineClips =
    project?.tracks.flatMap((track) =>
      track.kind === "video" ? track.clips : [],
    ) ?? [];

  useEffect(
    () => () => {
      if (scheduledTimelineActionFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledTimelineActionFrameRef.current);
      }
      if (scheduledClipDragPreviewFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledClipDragPreviewFrameRef.current);
      }
    },
    [],
  );

  const scheduleTimelineAction = (action: () => void) => {
    scheduledTimelineActionRef.current = action;
    if (scheduledTimelineActionFrameRef.current !== null) {
      return;
    }

    scheduledTimelineActionFrameRef.current = window.requestAnimationFrame(
      () => {
        scheduledTimelineActionFrameRef.current = null;
        const nextAction = scheduledTimelineActionRef.current;
        scheduledTimelineActionRef.current = null;
        nextAction?.();
      },
    );
  };

  const flushTimelineAction = () => {
    if (scheduledTimelineActionFrameRef.current !== null) {
      window.cancelAnimationFrame(scheduledTimelineActionFrameRef.current);
      scheduledTimelineActionFrameRef.current = null;
    }

    const nextAction = scheduledTimelineActionRef.current;
    scheduledTimelineActionRef.current = null;
    nextAction?.();
  };

  const scheduleClipDragPreview = (preview: TimelineClipDragPreview) => {
    scheduledClipDragPreviewRef.current = preview;
    if (scheduledClipDragPreviewFrameRef.current !== null) {
      return;
    }

    scheduledClipDragPreviewFrameRef.current = window.requestAnimationFrame(
      () => {
        scheduledClipDragPreviewFrameRef.current = null;
        setClipDragPreview(scheduledClipDragPreviewRef.current);
      },
    );
  };

  const clearClipDragPreview = () => {
    if (scheduledClipDragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(scheduledClipDragPreviewFrameRef.current);
      scheduledClipDragPreviewFrameRef.current = null;
    }
    scheduledClipDragPreviewRef.current = null;
    setClipDragPreview(null);
  };

  const getTimelineBounds = () => {
    const timelineGrid = timelineGridRef.current;
    if (!timelineGrid) {
      return null;
    }

    const bounds = timelineGrid.getBoundingClientRect();

    return {
      bounds,
      timelineLeft: bounds.left + labelColumnWidth,
      timelineWidth: bounds.width - labelColumnWidth,
    };
  };

  const resolveTimelineSeconds = (
    clientX: number,
    durationSeconds = visibleDurationSeconds,
  ) => {
    const timelineBounds = getTimelineBounds();
    if (!timelineBounds) {
      return 0;
    }

    return resolveTimelineSecondsFromClientX({
      clientX,
      timelineLeft: timelineBounds.timelineLeft,
      timelineWidth: timelineBounds.timelineWidth,
      visibleDurationSeconds: durationSeconds,
    });
  };

  const resolveCurrentClipDragPreview = (
    dragState: Extract<TimelineDragState, { kind: "move" }>,
    clientX: number,
    clientY: number,
  ): TimelineClipDragPreview | null => {
    const timelineBounds = getTimelineBounds();
    if (!timelineBounds) {
      return null;
    }

    const timelineSeconds = resolveTimelineSeconds(
      clientX,
      dragState.visibleDurationSeconds,
    );
    return resolveClipDragPreview({
      clientY,
      dragState,
      timelineBounds,
      timelineClips,
      timelineSeconds,
    });
  };

  const handleTimelinePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const trimHandle = target.closest<HTMLButtonElement>("[data-trim-edge]");
    if (trimHandle) {
      const clipId = trimHandle.dataset.clipId;
      const edge = trimHandle.dataset.trimEdge;
      if (!clipId || (edge !== "start" && edge !== "end")) {
        return;
      }

      const timelineSeconds = resolveTimelineSeconds(event.clientX);
      event.preventDefault();
      beginHistoryTransaction("Trim");
      selectTimelineClip(clipId);
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        clipId,
        edge,
        kind: "trim",
        pointerId: event.pointerId,
        visibleDurationSeconds,
      };
      trimTimelineClipEdge(clipId, edge, timelineSeconds);
      return;
    }

    const timelineSeconds = resolveTimelineSeconds(event.clientX);

    if (target.closest("[data-playhead-handle]")) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        kind: "playhead",
        pointerId: event.pointerId,
        visibleDurationSeconds,
      };
      setPlaybackSeconds(timelineSeconds);
      return;
    }

    const clipBody = target.closest<HTMLButtonElement>("[data-clip-body]");
    if (clipBody) {
      const clipId = clipBody.dataset.clipId;
      const clipDurationSeconds = Number(clipBody.dataset.clipDurationSeconds);
      const clipStartSeconds = Number(clipBody.dataset.clipStartSeconds);
      const clipElement = clipBody.closest<HTMLElement>("[data-timeline-clip]");
      const clipBounds = clipElement?.getBoundingClientRect() ?? null;
      if (
        !clipId ||
        !Number.isFinite(clipDurationSeconds) ||
        !Number.isFinite(clipStartSeconds)
      ) {
        return;
      }

      event.preventDefault();
      selectTimelineClip(clipId);
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        clipId,
        clipDurationSeconds,
        clipHeightPixels: clipBounds?.height ?? 56,
        grabOffsetSeconds: timelineSeconds - clipStartSeconds,
        grabOffsetYPixels: clipBounds ? event.clientY - clipBounds.top : 0,
        hasTransaction: false,
        isMoving: false,
        kind: "move",
        latestCursorSeconds: null,
        latestPreview: null,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        visibleDurationSeconds,
      };
      return;
    }

    const canSeekFromTarget = target.closest(
      "[data-timeline-marker-zone], [data-timeline-gap-zone]",
    );
    if (
      event.button === 0 &&
      canSeekFromTarget &&
      !target.closest("[data-gap-delete-button]")
    ) {
      event.preventDefault();
      setPlaybackSeconds(timelineSeconds);
    }
  };

  const handleTimelinePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    event.preventDefault();
    const timelineSeconds = resolveTimelineSeconds(
      event.clientX,
      dragState.visibleDurationSeconds,
    );
    if (dragState.kind === "playhead") {
      setPlaybackSeconds(timelineSeconds);
      return;
    }

    if (dragState.kind === "move") {
      if (
        !dragState.isMoving &&
        Math.abs(event.clientX - dragState.startClientX) <
          clipMoveActivationPixels
      ) {
        return;
      }

      dragState.isMoving = true;
      if (!dragState.hasTransaction) {
        dragState.hasTransaction = true;
        beginHistoryTransaction("Move");
      }
      const preview = resolveCurrentClipDragPreview(
        dragState,
        event.clientX,
        event.clientY,
      );
      if (!preview) {
        return;
      }

      dragState.latestCursorSeconds = timelineSeconds;
      dragState.latestPreview = preview;
      scheduleClipDragPreview(preview);
      return;
    }

    scheduleTimelineAction(() => {
      trimTimelineClipEdge(dragState.clipId, dragState.edge, timelineSeconds);
    });
  };

  const handleTimelinePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(dragState.pointerId)) {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    }
    flushTimelineAction();
    if (
      dragState.kind === "move" &&
      dragState.isMoving &&
      dragState.latestPreview
    ) {
      moveTimelineClip(
        dragState.clipId,
        dragState.latestPreview.startSeconds,
        dragState.latestCursorSeconds ?? dragState.latestPreview.startSeconds,
      );
    }
    commitHistoryTransaction();
    dragStateRef.current = null;
    clearClipDragPreview();
  };

  return {
    clipDragPreview,
    handleTimelinePointerDown,
    handleTimelinePointerEnd,
    handleTimelinePointerMove,
    timelineGridRef,
  };
}

export { useEditorTimelineDrag };
