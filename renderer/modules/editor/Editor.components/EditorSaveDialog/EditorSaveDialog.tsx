import clsx from "clsx";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import { FiFilePlus, FiSave } from "react-icons/fi";

import type {
  EditorExportInput,
  EditorExportResolution,
} from "~/main/modules/editor";
import { Modal, type ModalHandle } from "~/renderer/components/Modal/Modal";

interface EditorSaveDialogProps {
  dialogRef: RefObject<ModalHandle | null>;
  fileName: string;
  isSaveDisabled: boolean;
  mode: EditorExportInput["mode"];
  resolution: EditorExportResolution;
  onClose: () => void;
  onFileNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSet720p: () => void;
  onSet1080p: () => void;
  onSetNewFileMode: () => void;
  onSetOverwriteMode: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function EditorSaveDialog({
  dialogRef,
  fileName,
  isSaveDisabled,
  mode,
  resolution,
  onClose,
  onFileNameChange,
  onSet720p,
  onSet1080p,
  onSetNewFileMode,
  onSetOverwriteMode,
  onSubmit,
}: EditorSaveDialogProps) {
  return (
    <Modal
      ref={dialogRef}
      className="max-w-md rounded-lg border-base-content/10 p-0"
      surface="base-200"
    >
      <div className="border-base-content/10 border-b p-4">
        <h2 className="m-0 font-bold text-base">Save video</h2>
        <p className="m-0 mt-1 text-base-content/60 text-sm">
          Choose how this edit should be written.
        </p>
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid gap-4 p-4">
          <label className="form-control gap-2">
            <span className="label-text text-base-content/70 text-xs">
              File name
            </span>
            <span className="join">
              <input
                className="input input-bordered input-sm join-item min-w-0 flex-1"
                maxLength={156}
                required
                type="text"
                value={fileName}
                onChange={onFileNameChange}
              />
              <span
                aria-disabled="true"
                className="join-item grid h-8 place-items-center border border-base-content/20 border-l-0 bg-base-300 px-3 text-base-content/55 text-sm"
              >
                .mp4
              </span>
            </span>
          </label>

          <div className="grid gap-2">
            <span className="text-base-content/70 text-xs">Save as</span>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-base-content/10 bg-base-300/60 p-1">
              <button
                className={clsx(
                  "btn btn-sm justify-start",
                  mode === "overwrite"
                    ? "btn-primary"
                    : "border-base-content/15 bg-base-200/80 hover:bg-base-300",
                )}
                type="button"
                onClick={onSetOverwriteMode}
              >
                <FiSave size={15} />
                Override
              </button>
              <button
                className={clsx(
                  "btn btn-sm justify-start",
                  mode === "new-file"
                    ? "btn-primary"
                    : "border-base-content/15 bg-base-200/80 hover:bg-base-300",
                )}
                type="button"
                onClick={onSetNewFileMode}
              >
                <FiFilePlus size={15} />
                New MP4
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-base-content/70 text-xs">Resolution</span>
            <div className="join no-drag rounded-lg border border-base-content/10 bg-base-300/60 p-1">
              <button
                className={clsx(
                  "btn btn-sm join-item flex-1",
                  resolution === "720p"
                    ? "btn-primary"
                    : "border-base-content/15 bg-base-200/80 hover:bg-base-300",
                )}
                type="button"
                onClick={onSet720p}
              >
                720p
              </button>
              <button
                className={clsx(
                  "btn btn-sm join-item flex-1",
                  resolution === "1080p"
                    ? "btn-primary"
                    : "border-base-content/15 bg-base-200/80 hover:bg-base-300",
                )}
                type="button"
                onClick={onSet1080p}
              >
                1080p
              </button>
            </div>
          </div>
        </div>

        <div className="modal-action border-base-content/10 border-t p-4">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!fileName.trim() || isSaveDisabled}
            type="submit"
          >
            Save video
          </button>
        </div>
      </form>
    </Modal>
  );
}

export { EditorSaveDialog };
