import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { FiEdit2 } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

const loadMoreProjectValue = "__load-more-projects__";

function EditorProjectPicker() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const {
    isClipboardBusy,
    loadMoreProjects,
    openProject,
    project,
    saveProject,
    workspace,
  } = useEditorShallow((editor) => ({
    isClipboardBusy: editor.clipboardState.status === "copying",
    loadMoreProjects: editor.loadMoreProjects,
    openProject: editor.openProject,
    project: editor.project,
    saveProject: editor.saveProject,
    workspace: editor.workspace,
  }));
  const projects = workspace?.projects ?? [];
  const selectedProjectId = projects.some((item) => item.id === project?.id)
    ? (project?.id ?? "")
    : "";
  const isRenameDisabled = isClipboardBusy || !project || !selectedProjectId;

  const handleProjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (isClipboardBusy) {
      return;
    }

    const projectId = event.currentTarget.value;
    if (projectId === loadMoreProjectValue) {
      void loadMoreProjects();
      return;
    }

    if (!projectId || projectId === project?.id) {
      return;
    }

    void openProject(projectId);
  };

  const handleOpenRenameDialog = () => {
    if (!project || isRenameDisabled) {
      return;
    }

    setDraftTitle(project.title);
    dialogRef.current?.showModal();
  };

  const handleDraftTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftTitle(event.currentTarget.value);
  };

  const handleCloseDialog = () => {
    dialogRef.current?.close();
  };

  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!project || !title || isClipboardBusy) {
      return;
    }

    handleCloseDialog();
    void saveProject({
      ...project,
      title,
    });
  };

  return (
    <>
      <div className="join no-drag" data-onboarding="editor-profiles">
        <select
          aria-label="Editor project"
          className="select select-bordered select-sm join-item w-48"
          disabled={isClipboardBusy}
          value={selectedProjectId}
          onChange={handleProjectChange}
        >
          <option value="" disabled>
            Default
          </option>
          {projects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
          {workspace?.hasMoreProjects && (
            <option value={loadMoreProjectValue}>Load more edits...</option>
          )}
        </select>
        <button
          aria-label="Rename project"
          className="btn btn-sm join-item border-base-content/20 bg-base-200 hover:bg-base-300"
          disabled={isRenameDisabled}
          title="Rename project"
          type="button"
          onClick={handleOpenRenameDialog}
        >
          <FiEdit2 size={15} />
        </button>
      </div>

      <dialog className="modal" ref={dialogRef}>
        <div className="modal-box max-w-sm rounded-lg border border-base-content/10 bg-base-200 p-0">
          <div className="border-base-content/10 border-b p-4">
            <h2 className="m-0 font-bold text-base">Rename project</h2>
            <p className="m-0 mt-1 text-base-content/60 text-sm">
              Give this editor project a clearer name.
            </p>
          </div>

          <form onSubmit={handleRenameSubmit}>
            <div className="p-4">
              <label className="form-control gap-1">
                <span className="label-text text-base-content/70 text-xs">
                  Project name
                </span>
                <input
                  autoFocus
                  className="input input-bordered input-sm"
                  disabled={isClipboardBusy}
                  maxLength={120}
                  required
                  type="text"
                  value={draftTitle}
                  onChange={handleDraftTitleChange}
                />
              </label>
            </div>

            <div className="modal-action border-base-content/10 border-t p-4">
              <button
                className="btn btn-ghost btn-sm"
                disabled={isClipboardBusy}
                type="button"
                onClick={handleCloseDialog}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={isClipboardBusy || !draftTitle.trim()}
                type="submit"
              >
                Rename
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

export { EditorProjectPicker };
