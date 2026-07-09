import clsx from "clsx";

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
  playbackSeconds: number;
  playheadRef?: (element: HTMLSpanElement | null) => void;
  trim: ClipPreviewTrimRange;
  onSeek: (seconds: number, options?: { preservePlayback?: boolean }) => void;
  onTrimChange: (
    trim: ClipPreviewTrimRange,
    options?: { previewMedia?: boolean; previewSeconds: number },
  ) => void;
}

function ClipPreviewTrimRail({
  disabled,
  durationSeconds,
  playbackSeconds,
  playheadRef,
  trim,
  onSeek,
  onTrimChange,
}: ClipPreviewTrimRailProps) {
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
    onTrimChange,
  });
  const trimStartPercent = calculateClipPreviewTimelinePercent(
    trim.inSeconds,
    durationSeconds,
  );
  const trimEndPercent = calculateClipPreviewTimelinePercent(
    trim.outSeconds,
    durationSeconds,
  );
  const playbackPercent = calculateClipPreviewTimelinePercent(
    playbackSeconds,
    durationSeconds,
  );
  const trimWidthPercent = Math.max(trimEndPercent - trimStartPercent, 0);
  const useDetachedEdgeLabels = trimWidthPercent < 20;
  const trimCenterPercent = trimStartPercent + trimWidthPercent / 2;

  return (
    <div className={styles.rail}>
      <div className={styles.labels}>
        <span
          className={clsx(
            styles.timeLabel,
            styles.startTime,
            useDetachedEdgeLabels && styles.startTimeDetached,
          )}
          style={
            useDetachedEdgeLabels ? undefined : { left: `${trimStartPercent}%` }
          }
        >
          {formatClipPreviewTimestamp(trim.inSeconds)}
        </span>
        <span
          className={styles.duration}
          style={{ left: `${trimCenterPercent}%` }}
        >
          {formatClipPreviewTimestamp(trim.outSeconds - trim.inSeconds)}
        </span>
        <span
          className={clsx(
            styles.timeLabel,
            styles.endTime,
            useDetachedEdgeLabels && styles.endTimeDetached,
          )}
          style={
            useDetachedEdgeLabels ? undefined : { left: `${trimEndPercent}%` }
          }
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
        <span
          className={styles.shade}
          style={{ left: 0, width: `${trimStartPercent}%` }}
        />
        <span
          className={styles.shade}
          style={{ left: `${trimEndPercent}%`, right: 0 }}
        />
        <button
          aria-label="Move selected trim range"
          className={clsx(
            styles.selection,
            isSelectionDragging && styles.selectionDragging,
          )}
          disabled={disabled}
          style={{
            left: `${trimStartPercent}%`,
            width: `${trimWidthPercent}%`,
          }}
          type="button"
          onPointerDown={handleSelectionPointerDown}
        />
        <span
          className={styles.playheadLayer}
          ref={playheadRef}
          style={{ transform: `translate3d(${playbackPercent}%, 0, 0)` }}
        >
          <span className={styles.playhead} />
        </span>
        <button
          aria-label="Trim clip start"
          className={clsx(styles.handle, styles.handleStart)}
          disabled={disabled}
          style={{ left: `${trimStartPercent}%` }}
          type="button"
          onPointerDown={handleStartPointerDown}
        />
        <button
          aria-label="Trim clip end"
          className={clsx(styles.handle, styles.handleEnd)}
          disabled={disabled}
          style={{ left: `${trimEndPercent}%` }}
          type="button"
          onPointerDown={handleEndPointerDown}
        />
      </div>
    </div>
  );
}

export { ClipPreviewTrimRail };
