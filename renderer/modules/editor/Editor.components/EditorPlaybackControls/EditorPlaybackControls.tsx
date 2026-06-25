import {
  FiPause,
  FiPlay,
  FiRotateCcw,
  FiRotateCw,
  FiSkipBack,
} from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { formatEditorTimestamp } from "../../Editor.utils/Editor.utils";

function EditorPlaybackControls() {
  const {
    isPreviewPlaying,
    playbackSeconds,
    project,
    selectedClipId,
    setPlaybackSeconds,
    setPreviewPlaying,
  } = useEditorShallow((editor) => ({
    isPreviewPlaying: editor.isPreviewPlaying,
    playbackSeconds: editor.playbackSeconds,
    project: editor.project,
    selectedClipId: editor.selectedClipId,
    setPlaybackSeconds: editor.setPlaybackSeconds,
    setPreviewPlaying: editor.setPreviewPlaying,
  }));
  const durationSeconds = project?.durationSeconds ?? 0;
  const isDisabled = !selectedClipId;

  const handleJumpToStart = () => {
    if (isDisabled) {
      return;
    }

    setPlaybackSeconds(0);
    setPreviewPlaying(false);
  };

  const handleSeekBackward = () => {
    if (isDisabled) {
      return;
    }

    setPlaybackSeconds(playbackSeconds - 5);
  };

  const handleSeekForward = () => {
    if (isDisabled) {
      return;
    }

    setPlaybackSeconds(playbackSeconds + 5);
  };

  const handleTogglePlayback = () => {
    if (isDisabled) {
      return;
    }

    setPreviewPlaying(!isPreviewPlaying);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        aria-label="Jump to start"
        className="btn btn-ghost btn-xs"
        disabled={isDisabled}
        type="button"
        onClick={handleJumpToStart}
      >
        <FiSkipBack size={15} />
      </button>
      <button
        aria-label="Seek backward 5 seconds"
        className="btn btn-ghost btn-xs gap-0.5"
        disabled={isDisabled}
        type="button"
        onClick={handleSeekBackward}
      >
        <FiRotateCcw size={14} />
        <span className="text-[9px] leading-none">5</span>
      </button>
      <button
        aria-label="Seek forward 5 seconds"
        className="btn btn-ghost btn-xs gap-0.5"
        disabled={isDisabled}
        type="button"
        onClick={handleSeekForward}
      >
        <FiRotateCw size={14} />
        <span className="text-[9px] leading-none">5</span>
      </button>
      <button
        aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}
        className="btn btn-circle btn-primary btn-sm"
        disabled={isDisabled}
        type="button"
        onClick={handleTogglePlayback}
      >
        {isPreviewPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
      </button>
      <div className="min-w-28 text-sm tabular-nums">
        <span
          className="font-bold text-base-content"
          data-editor-playback-time="true"
        >
          {formatEditorTimestamp(playbackSeconds)}
        </span>
        <span className="text-base-content/45">
          {" "}
          / {formatEditorTimestamp(durationSeconds)}
        </span>
      </div>
    </div>
  );
}

export { EditorPlaybackControls };
