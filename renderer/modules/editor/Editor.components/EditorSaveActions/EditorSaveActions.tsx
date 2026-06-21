import clsx from "clsx";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { FiSave } from "react-icons/fi";

import type {
  EditorExportInput,
  EditorExportResolution,
} from "~/main/modules/editor";
import type { ModalHandle } from "~/renderer/components/Modal/Modal";
import { useEditorShallow } from "~/renderer/store";

import { createEditorDefaultFileName } from "../../Editor.utils/Editor.utils";
import { EditorSaveDialog } from "../EditorSaveDialog/EditorSaveDialog";
import { createSaveDisabledReason } from "./EditorSaveActions.utils";

interface EditorSaveActionsProps {
  variant?: "button" | "menu";
}

function EditorSaveActions({ variant = "button" }: EditorSaveActionsProps) {
  const dialogRef = useRef<ModalHandle>(null);
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
    dialogRef.current?.open();
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

      <EditorSaveDialog
        dialogRef={dialogRef}
        fileName={fileName}
        isSaveDisabled={isSaveDisabled}
        mode={mode}
        resolution={resolution}
        onClose={handleCloseDialog}
        onFileNameChange={handleFileNameChange}
        onSet720p={handleSet720p}
        onSet1080p={handleSet1080p}
        onSetNewFileMode={handleSetNewFileMode}
        onSetOverwriteMode={handleSetOverwriteMode}
        onSubmit={handleSubmit}
      />
    </>
  );
}

export { EditorSaveActions };
