import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FiEdit2, FiFolder, FiTrash2 } from "react-icons/fi";

import type { SavedEditItem } from "~/main/modules/saved-edits";
import { EditorDeleteConfirmationModal } from "~/renderer/modules/editor/Editor.components/EditorDeleteConfirmationModal/EditorDeleteConfirmationModal";
import { useSavedEditsShallow } from "~/renderer/store";

interface SavedEditTableActionsProps {
  edit: SavedEditItem;
}

function SavedEditTableActions({ edit }: SavedEditTableActionsProps) {
  const navigate = useNavigate();
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { deleteEdit, revealEditInExplorer } = useSavedEditsShallow(
    (savedEdits) => ({
      deleteEdit: savedEdits.deleteEdit,
      revealEditInExplorer: savedEdits.revealEditInExplorer,
    }),
  );

  const handleOpenEdit = () => {
    void navigate({
      to: "/editor",
      search: { projectId: edit.id },
    });
  };

  const handleRevealInExplorer = () => {
    void revealEditInExplorer(edit.id);
  };

  const handleOpenDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
  };

  const handleConfirmDelete = () => {
    void deleteEdit(edit.id);
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <div className="join no-drag">
        <button
          aria-label={`Open saved edit ${edit.title}`}
          className="btn btn-ghost btn-xs join-item"
          title="Open in editor"
          type="button"
          onClick={handleOpenEdit}
        >
          <FiEdit2 size={14} />
        </button>
        <button
          aria-label={`Open ${edit.title} in explorer`}
          className="btn btn-ghost btn-xs join-item"
          title="Open in explorer"
          type="button"
          onClick={handleRevealInExplorer}
        >
          <FiFolder size={14} />
        </button>
        <button
          aria-label={`Delete saved edit ${edit.title}`}
          className="btn btn-ghost btn-xs join-item text-error disabled:text-base-content/35"
          title="Delete edit"
          type="button"
          onClick={handleOpenDeleteConfirm}
        >
          <FiTrash2 size={14} />
        </button>
      </div>
      <EditorDeleteConfirmationModal
        confirmLabel="Delete edit"
        description={`This will remove "${edit.title}" from saved editor edits. Source recordings and clips will not be deleted.`}
        isOpen={isDeleteConfirmOpen}
        title="Delete edit?"
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export { SavedEditTableActions };
