import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi";

interface EditorDeleteConfirmationModalProps {
  confirmLabel: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

function EditorDeleteConfirmationModal({
  confirmLabel,
  description,
  isOpen,
  onClose,
  onConfirm,
  title,
}: EditorDeleteConfirmationModalProps) {
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

  return createPortal(
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="modal modal-bottom sm:modal-middle"
      ref={dialogRef}
      onClose={onClose}
    >
      <div className="modal-box border border-error/60">
        <div className="mb-4 flex items-center gap-3 text-red-500">
          <FiAlertTriangle className="h-6 w-6 shrink-0" />
          <h3 className="font-bold text-lg" id={titleId}>
            {title}
          </h3>
        </div>

        <p className="text-base-content/80 text-sm" id={descriptionId}>
          {description}
        </p>
        <p className="mt-3 font-semibold text-red-500 text-sm">
          This action cannot be undone.
        </p>

        <div className="modal-action">
          <button
            className="no-drag btn btn-ghost btn-sm"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="no-drag btn btn-error btn-sm"
            type="button"
            onClick={onConfirm}
          >
            <FiTrash2 />
            {confirmLabel}
          </button>
        </div>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>,
    document.body,
  );
}

export { EditorDeleteConfirmationModal };
