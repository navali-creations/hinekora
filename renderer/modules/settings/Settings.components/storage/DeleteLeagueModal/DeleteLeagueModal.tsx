import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi";

import type { StorageGameLeagueUsage } from "~/main/modules/storage/Storage.dto";

import { formatBytes, gameLabel } from "../storage.utils/storage.utils";

interface DeleteLeagueModalProps {
  league: StorageGameLeagueUsage | null;
  onClose: () => void;
  onConfirm: (league: StorageGameLeagueUsage) => void;
}

function DeleteLeagueModal({
  league,
  onClose,
  onConfirm,
}: DeleteLeagueModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [snapshot, setSnapshot] = useState<StorageGameLeagueUsage | null>(null);

  useEffect(() => {
    if (league) {
      setSnapshot(league);
      modalRef.current?.showModal();
    }
  }, [league]);

  const handleClose = useCallback(() => {
    modalRef.current?.close();
  }, []);

  const handleConfirm = useCallback(() => {
    if (!snapshot) {
      return;
    }

    modalRef.current?.close();
    onConfirm(snapshot);
  }, [onConfirm, snapshot]);

  const handleDialogClose = useCallback(() => {
    setTimeout(() => setSnapshot(null), 200);
    onClose();
  }, [onClose]);

  return (
    <dialog
      className="modal modal-bottom sm:modal-middle"
      ref={modalRef}
      onClose={handleDialogClose}
    >
      <div className="modal-box border border-error">
        <div className="mb-4 flex items-center gap-3 text-error">
          <FiAlertTriangle className="h-6 w-6 shrink-0" />
          <h3 className="font-bold text-lg">Delete League Data</h3>
        </div>

        {snapshot && (
          <>
            <p className="text-sm">
              Delete all Hinekora data for{" "}
              <strong>
                {snapshot.leagueName} ({gameLabel(snapshot.game)})
              </strong>
              ?
            </p>
            <p className="mt-2 text-base-content/70 text-sm">
              This will remove:
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-base-content/80 text-sm">
              <li>
                {snapshot.clipCount} death clip
                {snapshot.clipCount !== 1 ? "s" : ""}
              </li>
              <li>
                {snapshot.recordingCount} session recording
                {snapshot.recordingCount !== 1 ? "s" : ""}
              </li>
              <li>Saved database rows for this game and league</li>
            </ul>
            <p className="mt-2 text-base-content/50 text-xs">
              Estimated space freed: ~{formatBytes(snapshot.estimatedSizeBytes)}
            </p>
            <p className="mt-3 font-semibold text-error text-sm">
              This action cannot be undone.
            </p>
          </>
        )}

        <div className="modal-action">
          <button
            className="no-drag btn btn-ghost btn-sm"
            type="button"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="no-drag btn btn-error btn-sm"
            type="button"
            onClick={handleConfirm}
          >
            <FiTrash2 />
            Delete League Data
          </button>
        </div>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button type="button" onClick={handleClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

export default DeleteLeagueModal;
