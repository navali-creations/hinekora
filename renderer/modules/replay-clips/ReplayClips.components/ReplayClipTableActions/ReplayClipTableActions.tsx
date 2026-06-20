import type { MouseEvent } from "react";
import {
  FiFolder as FolderOpen,
  FiPlay as Play,
  FiTrash2 as Trash2,
} from "react-icons/fi";

import { useReplayClipsShallow } from "~/renderer/store";

import type { ReplayClip } from "~/types";
import { hasPlayableClip } from "../ReplayClipsPanel/ReplayClipsPanel.utils";

interface ReplayClipTableActionsProps {
  clip: ReplayClip;
}

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
      <button
        aria-label="Open clip"
        className="btn btn-primary btn-square btn-xs"
        data-clip-id={clip.id}
        disabled={!playable}
        title="Open clip"
        type="button"
        onClick={handleOpenClip}
      >
        <Play size={14} />
      </button>
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
