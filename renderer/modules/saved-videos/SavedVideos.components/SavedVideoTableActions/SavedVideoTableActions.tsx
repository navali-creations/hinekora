import { useState } from "react";
import { FiFolder, FiPlay, FiTrash2 } from "react-icons/fi";

import type { SavedVideoItem } from "~/main/modules/saved-videos";
import { EditorDeleteConfirmationModal } from "~/renderer/modules/editor/Editor.components/EditorDeleteConfirmationModal/EditorDeleteConfirmationModal";
import { useSavedVideosShallow } from "~/renderer/store";

interface SavedVideoTableActionsProps {
  video: SavedVideoItem;
}

function SavedVideoTableActions({ video }: SavedVideoTableActionsProps) {
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { deleteVideo, openVideo, revealVideo } = useSavedVideosShallow(
    (savedVideos) => ({
      deleteVideo: savedVideos.deleteVideo,
      openVideo: savedVideos.openVideo,
      revealVideo: savedVideos.revealVideo,
    }),
  );

  const handleOpen = () => {
    void openVideo(video.id);
  };

  const handleReveal = () => {
    void revealVideo(video.id);
  };

  const handleOpenDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
  };

  const handleConfirmDelete = () => {
    void deleteVideo(video.id);
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <div className="join no-drag">
        <button
          aria-label={`Play saved edit ${video.fileName}`}
          className="btn btn-ghost btn-xs join-item"
          title="Play video"
          type="button"
          onClick={handleOpen}
        >
          <FiPlay size={14} />
        </button>
        <button
          aria-label={`Open ${video.fileName} in explorer`}
          className="btn btn-ghost btn-xs join-item"
          title="Open in explorer"
          type="button"
          onClick={handleReveal}
        >
          <FiFolder size={14} />
        </button>
        <button
          aria-label={`Delete saved edit ${video.fileName}`}
          className="btn btn-ghost btn-xs join-item text-error"
          title="Delete saved edit"
          type="button"
          onClick={handleOpenDeleteConfirm}
        >
          <FiTrash2 size={14} />
        </button>
      </div>
      <EditorDeleteConfirmationModal
        confirmLabel="Delete video"
        description={`This permanently deletes "${video.fileName}" from your exports folder.`}
        isOpen={isDeleteConfirmOpen}
        title="Delete saved edit?"
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export { SavedVideoTableActions };
