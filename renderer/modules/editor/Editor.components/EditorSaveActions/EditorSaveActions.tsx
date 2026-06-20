import clsx from "clsx";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { FiFilePlus, FiSave } from "react-icons/fi";

import type {
  EditorExportInput,
  EditorExportResolution,
} from "~/main/modules/editor";
import { useEditorShallow } from "~/renderer/store";

import { createEditorDefaultFileName } from "../../Editor.utils/Editor.utils";
import { createSaveDisabledReason } from "./EditorSaveActions.utils";

interface EditorSaveActionsProps {
  variant?: "button" | "menu";
}

function EditorSaveActions({ variant = "button" }: EditorSaveActionsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { exportProject, exportStatus, project, selectedClipId } =
    useEditorShallow((editor) => ({
      exportProject: editor.exportProject,
      exportStatus: editor.exportState.status,
      project: editor.project,
      selectedClipId: editor.selectedClipId,
    }));
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<EditorExportInput["mode"]>("new-file");
  const [resolution, setResolution] = useState<EditorExportResolution>("1080p");
  const isExporting = exportStatus === "exporting";
  const isSaveDisabled = !project || !selectedClipId || isExporting;
  const disabledReason = createSaveDisabledReason({
    isExporting,
    project,
    selectedClipId,
  });

  const handleOpenDialog = () => {
    if (isSaveDisabled) {
      return;
    }

    setFileName(createEditorDefaultFileName(project));
    setMode("new-file");
    setResolution("1080p");
    dialogRef.current?.showModal();
  };

  const handleCloseDialog = () => {
    dialogRef.current?.close();
  };

  const handleFileNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFileName(event.currentTarget.value);
  };

  const handleSetOverwriteMode = () => {
    setMode("overwrite");
  };

  const handleSetNewFileMode = () => {
    setMode("new-file");
  };

  const handleSet720p = () => {
    setResolution("720p");
  };

  const handleSet1080p = () => {
    setResolution("1080p");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaveDisabled || !fileName.trim()) {
      return;
    }

    handleCloseDialog();
    void exportProject({
      fileName: fileName.trim(),
      mode,
      resolution,
    });
  };

  const button = (
    <button
      className={clsx(
        "no-drag",
        variant === "menu"
          ? "flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300 disabled:cursor-not-allowed disabled:opacity-45"
          : "btn btn-primary btn-sm",
      )}
      disabled={isSaveDisabled}
      type="button"
      onClick={handleOpenDialog}
    >
      Save
      <FiSave size={15} />
    </button>
  );
  const disabledMenuRow =
    variant === "menu" && disabledReason ? (
      <div
        className="tooltip tooltip-left no-drag block w-full"
        data-tip={disabledReason}
      >
        <span
          aria-disabled="true"
          className="flex h-8 w-full cursor-not-allowed items-center justify-between gap-3 rounded-md px-3 text-left text-base-content/45 text-sm"
        >
          <span>Save</span>
          <FiSave size={15} />
        </span>
      </div>
    ) : null;
  const saveButton =
    disabledMenuRow ??
    (disabledReason ? (
      <div
        className={clsx(
          "tooltip tooltip-left no-drag",
          variant === "menu" && "w-full",
        )}
        data-tip={disabledReason}
      >
        {button}
      </div>
    ) : (
      button
    ));

  return (
    <>
      {saveButton}

      <dialog className="modal" ref={dialogRef}>
        <div className="modal-box max-w-md rounded-lg border border-base-content/10 bg-base-200 p-0">
          <div className="border-base-content/10 border-b p-4">
            <h2 className="m-0 font-bold text-base">Save edited clip</h2>
            <p className="m-0 mt-1 text-base-content/60 text-sm">
              Choose how this edit should be written.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 p-4">
              <label className="form-control gap-1">
                <span className="label-text text-base-content/70 text-xs">
                  File name
                </span>
                <input
                  className="input input-bordered input-sm"
                  maxLength={160}
                  required
                  type="text"
                  value={fileName}
                  onChange={handleFileNameChange}
                />
              </label>

              <div className="grid gap-2">
                <span className="text-base-content/70 text-xs">Export as</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={clsx(
                      "btn btn-sm justify-start",
                      mode === "overwrite" ? "btn-primary" : "btn-ghost",
                    )}
                    type="button"
                    onClick={handleSetOverwriteMode}
                  >
                    <FiSave size={15} />
                    Override
                  </button>
                  <button
                    className={clsx(
                      "btn btn-sm justify-start",
                      mode === "new-file" ? "btn-primary" : "btn-ghost",
                    )}
                    type="button"
                    onClick={handleSetNewFileMode}
                  >
                    <FiFilePlus size={15} />
                    New MP4
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-base-content/70 text-xs">Resolution</span>
                <div className="join no-drag">
                  <button
                    className={clsx(
                      "btn btn-sm join-item flex-1",
                      resolution === "720p" ? "btn-primary" : "btn-ghost",
                    )}
                    type="button"
                    onClick={handleSet720p}
                  >
                    720p
                  </button>
                  <button
                    className={clsx(
                      "btn btn-sm join-item flex-1",
                      resolution === "1080p" ? "btn-primary" : "btn-ghost",
                    )}
                    type="button"
                    onClick={handleSet1080p}
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
                onClick={handleCloseDialog}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!fileName.trim() || isSaveDisabled}
                type="submit"
              >
                Export video
              </button>
            </div>
          </form>
        </div>
        <form className="modal-backdrop" method="dialog">
          <button type="submit">Close</button>
        </form>
      </dialog>
    </>
  );
}

export { EditorSaveActions };
