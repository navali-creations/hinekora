import { useEffect, useRef } from "react";
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi";

import { Modal, type ModalHandle } from "~/renderer/components/Modal/Modal";

import { storageBytesPerGigabyte, storageCleanupTargetRatio } from "~/types";
import { formatBytes } from "../../storage/storage.utils/storage.utils";

interface StorageBudgetReductionConfirmationModalProps {
  currentUsageBytes: number | null;
  currentUsageIsPartial: boolean;
  kind: "export" | "recording";
  nextLimitGb: number;
  onCancel: () => void;
  onConfirm: () => void;
}

function StorageBudgetReductionConfirmationModal({
  currentUsageBytes,
  currentUsageIsPartial,
  kind,
  nextLimitGb,
  onCancel,
  onConfirm,
}: StorageBudgetReductionConfirmationModalProps) {
  const modalRef = useRef<ModalHandle>(null);
  const isConfirmingRef = useRef(false);
  const isRecording = kind === "recording";
  const targetUsageBytes =
    nextLimitGb * storageBytesPerGigabyte * storageCleanupTargetRatio;

  useEffect(() => {
    modalRef.current?.open();
  }, []);

  const handleCancel = () => {
    modalRef.current?.close();
  };
  const handleClose = () => {
    if (isConfirmingRef.current) {
      return;
    }
    onCancel();
  };
  const handleConfirm = () => {
    isConfirmingRef.current = true;
    modalRef.current?.close();
    onConfirm();
  };

  return (
    <Modal
      ref={modalRef}
      className="border-error/60"
      onClose={handleClose}
      size="sm"
      surface="base-200"
    >
      <div className="mb-4 flex items-center gap-3 text-error">
        <FiAlertTriangle className="h-6 w-6 shrink-0" />
        <h3 className="font-bold text-lg">
          Reduce {isRecording ? "recording" : "export"} storage?
        </h3>
      </div>

      {currentUsageBytes === null ? (
        <p className="text-base-content/80 text-sm">
          Current {isRecording ? "recording" : "export"} usage is still being
          calculated. If it exceeds the new {nextLimitGb} GB limit, automatic
          cleanup will begin.
        </p>
      ) : (
        <p className="text-base-content/80 text-sm">
          Your {isRecording ? "recordings and clips" : "saved edit videos"}{" "}
          currently use {currentUsageIsPartial ? "at least " : ""}
          {formatBytes(currentUsageBytes)}. The new {nextLimitGb} GB limit may
          be below that amount.
        </p>
      )}
      {isRecording ? (
        <>
          <p className="mt-3 text-base-content/70 text-sm">
            {currentUsageBytes === null
              ? "If cleanup is needed, Hinekora will"
              : "Hinekora will"}{" "}
            delete the oldest recordings and clips until usage is about{" "}
            {formatBytes(targetUsageBytes)}, leaving 5% of the new limit free.
          </p>
          <p className="mt-3 font-semibold text-error text-sm">
            Saved Edits are not affected. Deleted recordings and clips cannot be
            recovered.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-base-content/70 text-sm">
            Hinekora will delete the oldest saved edit videos until usage is
            about {formatBytes(targetUsageBytes)}, leaving 5% of the new limit
            free.
          </p>
          <p className="mt-3 font-semibold text-error text-sm">
            Recordings and clips are not affected. Deleted saved edit videos
            cannot be recovered.
          </p>
        </>
      )}

      <div className="modal-action">
        <button
          className="no-drag btn btn-ghost btn-sm"
          type="button"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          className="no-drag btn btn-error btn-sm"
          type="button"
          onClick={handleConfirm}
        >
          <FiTrash2 />
          Set {nextLimitGb} GB limit
        </button>
      </div>
    </Modal>
  );
}

export { StorageBudgetReductionConfirmationModal };
