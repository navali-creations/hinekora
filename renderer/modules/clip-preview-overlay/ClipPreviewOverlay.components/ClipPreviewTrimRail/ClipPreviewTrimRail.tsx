import clsx from "clsx";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef } from "react";

import {
  type ClipPreviewTrimRange,
  calculateClipPreviewTimelinePercent,
  formatClipPreviewTimestamp,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import styles from "./ClipPreviewTrimRail.module.css";
import { useClipPreviewTrimRailDrag } from "./useClipPreviewTrimRailDrag/useClipPreviewTrimRailDrag";

interface ClipPreviewTrimRailProps {
  disabled: boolean;
  durationSeconds: number;
  playheadRef?: (element: HTMLSpanElement | null) => void;
  trim: ClipPreviewTrimRange;
  onSeek: (seconds: number, options?: { preservePlayback?: boolean }) => void;
  onTrimCommit: (trim: ClipPreviewTrimRange) => void;
  onTrimPreview: (
    trim: ClipPreviewTrimRange,
    options: { previewSeconds: number },
  ) => void;
}

type ClipPreviewTrimRailStyle = CSSProperties & {
  "--clip-preview-trim-center": string;
  "--clip-preview-trim-end": string;
  "--clip-preview-trim-start": string;
  "--clip-preview-trim-width": string;
};

function ClipPreviewTrimRail({
  disabled,
  durationSeconds,
  playheadRef,
  trim,
  onSeek,
  onTrimCommit,
  onTrimPreview,
}: ClipPreviewTrimRailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const durationLabelRef = useRef<HTMLSpanElement>(null);
  const endLabelRef = useRef<HTMLSpanElement>(null);
  const startLabelRef = useRef<HTMLSpanElement>(null);
  const resolveTrimPresentation = useCallback(
    (nextTrim: ClipPreviewTrimRange) => {
      const startPercent = calculateClipPreviewTimelinePercent(
        nextTrim.inSeconds,
        durationSeconds,
      );
      const endPercent = calculateClipPreviewTimelinePercent(
        nextTrim.outSeconds,
        durationSeconds,
      );
      const widthPercent = Math.max(endPercent - startPercent, 0);

      return {
        centerPercent: startPercent + widthPercent / 2,
        endPercent,
        startPercent,
        useDetachedEdgeLabels: widthPercent < 20,
        widthPercent,
      };
    },
    [durationSeconds],
  );
  const syncTrimPresentation = useCallback(
    (nextTrim: ClipPreviewTrimRange) => {
      const presentation = resolveTrimPresentation(nextTrim);
      const container = containerRef.current;
      container?.style.setProperty(
        "--clip-preview-trim-start",
        `${presentation.startPercent}%`,
      );
      container?.style.setProperty(
        "--clip-preview-trim-end",
        `${presentation.endPercent}%`,
      );
      container?.style.setProperty(
        "--clip-preview-trim-width",
        `${presentation.widthPercent}%`,
      );
      container?.style.setProperty(
        "--clip-preview-trim-center",
        `${presentation.centerPercent}%`,
      );
      startLabelRef.current?.classList.toggle(
        styles.startTimeDetached!,
        presentation.useDetachedEdgeLabels,
      );
      endLabelRef.current?.classList.toggle(
        styles.endTimeDetached!,
        presentation.useDetachedEdgeLabels,
      );
      if (startLabelRef.current) {
        startLabelRef.current.textContent = formatClipPreviewTimestamp(
          nextTrim.inSeconds,
        );
      }
      if (durationLabelRef.current) {
        durationLabelRef.current.textContent = formatClipPreviewTimestamp(
          nextTrim.outSeconds - nextTrim.inSeconds,
        );
      }
      if (endLabelRef.current) {
        endLabelRef.current.textContent = formatClipPreviewTimestamp(
          nextTrim.outSeconds,
        );
      }
    },
    [resolveTrimPresentation],
  );
  const initialPresentation = resolveTrimPresentation(trim);
  const railStyle: ClipPreviewTrimRailStyle = {
    "--clip-preview-trim-center": `${initialPresentation.centerPercent}%`,
    "--clip-preview-trim-end": `${initialPresentation.endPercent}%`,
    "--clip-preview-trim-start": `${initialPresentation.startPercent}%`,
    "--clip-preview-trim-width": `${initialPresentation.widthPercent}%`,
  };
  const {
    handleEndPointerDown,
    handleRailPointerDown,
    handleRailPointerEnd,
    handleRailPointerMove,
    handleSelectionPointerDown,
    handleStartPointerDown,
    isSelectionDragging,
    railRef,
  } = useClipPreviewTrimRailDrag({
    disabled,
    durationSeconds,
    trim,
    onSeek,
    onTrimCommit,
    onTrimPreview,
    syncTrimPresentation,
  });

  useEffect(() => {
    syncTrimPresentation(trim);
  }, [syncTrimPresentation, trim]);

  return (
    <div
      className={clsx(
        styles.rail,
        isSelectionDragging && styles.railSelectionDragging,
      )}
      ref={containerRef}
      style={railStyle}
    >
      <div className={styles.labels}>
        <span
          className={clsx(
            styles.timeLabel,
            styles.startTime,
            initialPresentation.useDetachedEdgeLabels &&
              styles.startTimeDetached,
          )}
          ref={startLabelRef}
        >
          {formatClipPreviewTimestamp(trim.inSeconds)}
        </span>
        <span className={styles.duration} ref={durationLabelRef}>
          {formatClipPreviewTimestamp(trim.outSeconds - trim.inSeconds)}
        </span>
        <span
          className={clsx(
            styles.timeLabel,
            styles.endTime,
            initialPresentation.useDetachedEdgeLabels && styles.endTimeDetached,
          )}
          ref={endLabelRef}
        >
          {formatClipPreviewTimestamp(trim.outSeconds)}
        </span>
      </div>
      <div
        aria-disabled={disabled}
        aria-label="Clip trim timeline"
        className={styles.track}
        ref={railRef}
        role="group"
        onLostPointerCapture={handleRailPointerEnd}
        onPointerCancel={handleRailPointerEnd}
        onPointerDown={handleRailPointerDown}
        onPointerMove={handleRailPointerMove}
        onPointerUp={handleRailPointerEnd}
      >
        <span className={styles.shade} />
        <span className={styles.shade} />
        <button
          aria-label="Move selected trim range"
          className={clsx(
            styles.selection,
            isSelectionDragging && styles.selectionDragging,
          )}
          disabled={disabled}
          type="button"
          onPointerDown={handleSelectionPointerDown}
        />
        <span className={styles.playheadLayer} ref={playheadRef}>
          <span className={styles.playhead} />
        </span>
        <button
          aria-label="Trim clip start"
          className={clsx(styles.handle, styles.handleStart)}
          disabled={disabled}
          type="button"
          onPointerDown={handleStartPointerDown}
        />
        <button
          aria-label="Trim clip end"
          className={clsx(styles.handle, styles.handleEnd)}
          disabled={disabled}
          type="button"
          onPointerDown={handleEndPointerDown}
        />
      </div>
    </div>
  );
}

export { ClipPreviewTrimRail };
