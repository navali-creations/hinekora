import { useEditorShallow } from "~/renderer/store";

import { EditorDeleteAction } from "../EditorDeleteAction/EditorDeleteAction";

function EditorDeleteEditAction() {
  const { deleteProject, project, workspace } = useEditorShallow((editor) => ({
    deleteProject: editor.deleteProject,
    project: editor.project,
    workspace: editor.workspace,
  }));
  const isSavedProject = Boolean(
    project && workspace?.projects.some((item) => item.id === project.id),
  );

  const handleConfirmDeleteEdit = () => {
    if (!project || !isSavedProject) {
      return;
    }

    void deleteProject(project.id);
  };

  return (
    <EditorDeleteAction
      confirmDescription={`This will remove "${project?.title ?? "this edit"}" from saved editor edits. Source recordings and clips will not be deleted.`}
      confirmLabel="Delete edit"
      confirmTitle="Delete edit?"
      disabled={!isSavedProject}
      label="Delete edit"
      onConfirm={handleConfirmDeleteEdit}
    />
  );
}

export { EditorDeleteEditAction };
