import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Modal, type ModalHandle } from "~/renderer/components/Modal/Modal";
import { useBookmarksShallow } from "~/renderer/store";

function BookmarkRenameDialog() {
  const modalRef = useRef<ModalHandle>(null);
  const [label, setLabel] = useState("");
  const { closeManualRenameDialog, draft, isSaving, saveManualRename } =
    useBookmarksShallow((bookmarks) => ({
      closeManualRenameDialog: bookmarks.closeManualRenameDialog,
      draft: bookmarks.manualRenameDraft,
      isSaving: bookmarks.isManualRenameSaving,
      saveManualRename: bookmarks.saveManualRename,
    }));

  useEffect(() => {
    if (!draft) {
      modalRef.current?.close();
      return;
    }

    setLabel(draft.label);
    modalRef.current?.open();
  }, [draft]);

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLabel(event.currentTarget.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    void saveManualRename(label);
  };

  return (
    <Modal
      ref={modalRef}
      className="max-w-sm rounded-lg border-base-content/10 p-0"
      surface="base-200"
      onClose={closeManualRenameDialog}
    >
      <div className="border-base-content/10 border-b p-4">
        <h2 className="m-0 font-bold text-base">Rename bookmark</h2>
        <p className="m-0 mt-1 text-base-content/60 text-sm">
          Give this manual bookmark a clearer label.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-4">
          <label className="form-control gap-1">
            <span className="label-text text-base-content/70 text-xs">
              Bookmark label
            </span>
            <input
              autoFocus
              className="input input-bordered input-sm"
              disabled={isSaving}
              maxLength={120}
              required
              type="text"
              value={label}
              onChange={handleLabelChange}
            />
          </label>
        </div>

        <div className="modal-action border-base-content/10 border-t p-4">
          <button
            className="btn btn-ghost btn-sm"
            disabled={isSaving}
            type="button"
            onClick={closeManualRenameDialog}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={isSaving || !label.trim()}
            type="submit"
          >
            {isSaving ? "Saving..." : "Rename"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export { BookmarkRenameDialog };
