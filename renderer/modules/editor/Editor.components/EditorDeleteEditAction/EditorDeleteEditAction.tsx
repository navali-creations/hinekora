import { FiTrash2 } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

function EditorDeleteEditAction() {
  const { deleteProject, project, workspace } = useEditorShallow((editor) => ({
    deleteProject: editor.deleteProject,
    project: editor.project,
    workspace: editor.workspace,
  }));
  const isSavedProject = Boolean(
    project && workspace?.projects.some((item) => item.id === project.id),
  );

  const handleDeleteEdit = () => {
    if (!project || !isSavedProject) {
      return;
    }

    void deleteProject(project.id);
  };

  return (
    <button
      className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-red-400 text-sm transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-red-400/55 disabled:opacity-100"
      disabled={!isSavedProject}
      type="button"
      onClick={handleDeleteEdit}
    >
      Delete edit
      <FiTrash2 size={15} />
    </button>
  );
}

export { EditorDeleteEditAction };
