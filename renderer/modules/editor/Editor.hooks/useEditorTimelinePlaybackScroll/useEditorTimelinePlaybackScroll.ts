import { type RefObject, useCallback, useEffect, useRef } from "react";

import { resolveEditorTimelineFollowScroll } from "../../Editor.components/EditorTimeline/EditorTimeline.utils";
import { subscribeEditorPlaybackVisualTime } from "../../Editor.utils/Editor.utils";

interface UseEditorTimelinePlaybackScrollInput {
  isPreviewPlaying: boolean;
  paddingPixels: number;
  playbackSeconds: number;
  railPaddingPixels: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  timelineGridRef: RefObject<HTMLDivElement | null>;
  visibleDurationSeconds: number;
}

interface TimelinePlaybackScrollGeometry {
  scrollClientWidth: number;
  scrollWidth: number;
  timelineGridWidth: number;
}

function useEditorTimelinePlaybackScroll({
  isPreviewPlaying,
  paddingPixels,
  playbackSeconds,
  railPaddingPixels,
  scrollContainerRef,
  timelineGridRef,
  visibleDurationSeconds,
}: UseEditorTimelinePlaybackScrollInput) {
  const geometryRef = useRef<TimelinePlaybackScrollGeometry>({
    scrollClientWidth: 0,
    scrollWidth: 0,
    timelineGridWidth: 0,
  });
  const updateScrollGeometry = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const timelineGrid = timelineGridRef.current;
    if (!scrollContainer || !timelineGrid) {
      return;
    }

    geometryRef.current = {
      scrollClientWidth: scrollContainer.clientWidth,
      scrollWidth: scrollContainer.scrollWidth,
      timelineGridWidth: timelineGrid.getBoundingClientRect().width,
    };
  }, [scrollContainerRef, timelineGridRef]);
  const applyPlaybackScroll = useCallback(
    (nextPlaybackSeconds: number) => {
      if (!isPreviewPlaying) {
        return;
      }

      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) {
        return;
      }

      if (
        geometryRef.current.scrollClientWidth <= 0 ||
        geometryRef.current.scrollWidth <= 0 ||
        geometryRef.current.timelineGridWidth <= 0
      ) {
        updateScrollGeometry();
      }

      const nextScrollLeft = resolveEditorTimelineFollowScroll({
        paddingPixels,
        playbackSeconds: nextPlaybackSeconds,
        railPaddingPixels,
        scrollClientWidth: geometryRef.current.scrollClientWidth,
        scrollLeft: scrollContainer.scrollLeft,
        scrollWidth: geometryRef.current.scrollWidth,
        timelineGridWidth: geometryRef.current.timelineGridWidth,
        visibleDurationSeconds,
      });

      if (nextScrollLeft !== null) {
        scrollContainer.scrollLeft = nextScrollLeft;
      }
    },
    [
      isPreviewPlaying,
      paddingPixels,
      railPaddingPixels,
      scrollContainerRef,
      updateScrollGeometry,
      visibleDurationSeconds,
    ],
  );

  useEffect(() => {
    updateScrollGeometry();

    const scrollContainer = scrollContainerRef.current;
    const timelineGrid = timelineGridRef.current;
    if (
      !scrollContainer ||
      !timelineGrid ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateScrollGeometry);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(timelineGrid);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scrollContainerRef, timelineGridRef, updateScrollGeometry]);

  useEffect(() => {
    applyPlaybackScroll(playbackSeconds);
  }, [applyPlaybackScroll, playbackSeconds]);

  useEffect(() => {
    if (!isPreviewPlaying) {
      return;
    }

    return subscribeEditorPlaybackVisualTime(applyPlaybackScroll);
  }, [applyPlaybackScroll, isPreviewPlaying]);
}

export { useEditorTimelinePlaybackScroll };
