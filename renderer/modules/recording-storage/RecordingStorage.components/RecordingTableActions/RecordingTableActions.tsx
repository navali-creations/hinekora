import type { MouseEvent } from "react";
import {
  FiFolder as FolderOpen,
  FiPlay as Play,
  FiTrash2 as Trash2,
} from "react-icons/fi";

import type { RunRecordingItem } from "~/main/modules/recording-storage/RecordingStorage.dto";
import { useRecordingStorageShallow } from "~/renderer/store";

interface RecordingTableActionsProps {
  recording: RunRecordingItem;
}

function RecordingTableActions({ recording }: RecordingTableActionsProps) {
  const { deleteRecording, openRecording, revealRecording } =
    useRecordingStorageShallow((recordingStorage) => ({
      deleteRecording: recordingStorage.deleteRecording,
      openRecording: recordingStorage.openRecording,
      revealRecording: recordingStorage.revealRecording,
    }));

  const handleOpenRecording = (event: MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.dataset.path;
    if (path) {
      void openRecording(path);
    }
  };

  const handleRevealRecording = (event: MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.dataset.path;
    if (path) {
      void revealRecording(path);
    }
  };

  const handleDeleteRecording = (event: MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.dataset.path;
    if (path) {
      void deleteRecording(path);
    }
  };

  return (
    <div className="flex justify-end gap-1.5">
      <button
        aria-label="Open recording"
        className="btn btn-primary btn-square btn-xs"
        data-path={recording.path}
        disabled={!recording.exists}
        title="Open recording"
        type="button"
        onClick={handleOpenRecording}
      >
        <Play size={14} />
      </button>
      <button
        aria-label="Reveal recording"
        className="btn btn-primary btn-square btn-xs"
        data-path={recording.path}
        disabled={!recording.exists}
        title="Reveal recording"
        type="button"
        onClick={handleRevealRecording}
      >
        <FolderOpen size={14} />
      </button>
      <button
        aria-label="Delete recording"
        className="btn btn-ghost btn-square btn-xs text-error"
        data-path={recording.path}
        title="Delete recording"
        type="button"
        onClick={handleDeleteRecording}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export { RecordingTableActions };
