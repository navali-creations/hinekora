import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiXCircle } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

function EditorExportCancelConfirmationModal() {
  const { cancelExport, closeExportCancellationConfirmation, isOpen } =
    useEditorShallow((editor) => ({
      cancelExport: editor.cancelExport,
      closeExportCancellationConfirmation:
        editor.closeExportCancellationConfirmation,
      isOpen: editor.exportState.isCancelConfirmationOpen,
    }));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog?.open) {
      dialog?.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    void cancelExport();
  };

  return createPortal(
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="modal modal-bottom sm:modal-middle"
      ref={dialogRef}
      onClose={closeExportCancellationConfirmation}
    >
      <div className="modal-box border border-error/60">
        <div className="mb-4 flex items-center gap-3 text-red-500">
          <FiAlertTriangle className="h-6 w-6 shrink-0" />
          <h3 className="font-bold text-lg" id={titleId}>
            Cancel video processing?
          </h3>
        </div>
        <p className="text-base-content/80 text-sm" id={descriptionId}>
          Processing will stop and the unfinished video will be removed.
        </p>
        <p className="mt-3 font-semibold text-red-500 text-sm">
          This action cannot be undone.
        </p>
        <div className="modal-action">
          <button
            className="no-drag btn btn-ghost btn-sm"
            type="button"
            onClick={closeExportCancellationConfirmation}
          >
            Keep processing
          </button>
          <button
            className="no-drag btn btn-error btn-sm"
            type="button"
            onClick={handleConfirm}
          >
            <FiXCircle />
            Cancel processing
          </button>
        </div>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button type="button" onClick={closeExportCancellationConfirmation}>
          close
        </button>
      </form>
    </dialog>,
    document.body,
  );
}

export { EditorExportCancelConfirmationModal };
