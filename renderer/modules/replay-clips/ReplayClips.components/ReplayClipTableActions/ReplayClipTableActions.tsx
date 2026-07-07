import type { MouseEvent } from "react";
import {
  FiFolder as FolderOpen,
  FiPlay as Play,
  FiTrash2 as Trash2,
} from "react-icons/fi";
import { TbMovieOff as MovieOff } from "react-icons/tb";

import { useReplayClipsShallow } from "~/renderer/store";

import type { ReplayClip } from "~/types";
import { hasPlayableClip } from "../../ReplayClips.utils/ReplayClips.utils";

interface ReplayClipTableActionsProps {
  clip: ReplayClip;
}

const missingClipTooltip =
  "Video file is no longer available. Delete this clip to remove this missing entry.";

function ReplayClipTableActions({ clip }: ReplayClipTableActionsProps) {
  const { deleteClip, openClip, revealClip } = useReplayClipsShallow(
    (replayClips) => ({
      deleteClip: replayClips.deleteClip,
      openClip: replayClips.openClip,
      revealClip: replayClips.revealClip,
    }),
  );
  const playable = hasPlayableClip(clip);

  const handleOpenClip = (event: MouseEvent<HTMLButtonElement>) => {
    const clipId = event.currentTarget.dataset.clipId;
    if (clipId) {
      void openClip(clipId);
    }
  };

  const handleRevealClip = (event: MouseEvent<HTMLButtonElement>) => {
    const clipId = event.currentTarget.dataset.clipId;
    if (clipId) {
      void revealClip(clipId);
    }
  };

  const handleDeleteClip = (event: MouseEvent<HTMLButtonElement>) => {
    const clipId = event.currentTarget.dataset.clipId;
    if (clipId) {
      void deleteClip(clipId);
    }
  };

  return (
    <div className="flex justify-end gap-1.5">
      {playable ? (
        <button
          aria-label="Open clip"
          className="btn btn-primary btn-square btn-xs"
          data-clip-id={clip.id}
          title="Open clip"
          type="button"
          onClick={handleOpenClip}
        >
          <Play size={14} />
        </button>
      ) : (
        <div
          className="tooltip tooltip-left"
          data-row-click-ignore="true"
          data-tip={missingClipTooltip}
        >
          <span
            aria-label="Clip video unavailable"
            className="btn btn-square btn-xs cursor-help border-error/40 bg-error/10 text-error hover:border-error/40 hover:bg-error/10"
            role="img"
            title="Clip video unavailable"
          >
            <MovieOff size={14} />
          </span>
        </div>
      )}
      <button
        aria-label="Reveal clip"
        className="btn btn-primary btn-square btn-xs"
        data-clip-id={clip.id}
        disabled={!playable}
        title="Reveal clip"
        type="button"
        onClick={handleRevealClip}
      >
        <FolderOpen size={14} />
      </button>
      <button
        aria-label="Delete clip"
        className="btn btn-ghost btn-square btn-xs text-error"
        data-clip-id={clip.id}
        title="Delete clip"
        type="button"
        onClick={handleDeleteClip}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export { ReplayClipTableActions };
