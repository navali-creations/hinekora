import { useEditorShallow } from "~/renderer/store";

import { EditorDeleteAction } from "../EditorDeleteAction/EditorDeleteAction";

function EditorDeleteAllEditsAction() {
  const { deleteAllProjects, workspace } = useEditorShallow((editor) => ({
    deleteAllProjects: editor.deleteAllProjects,
    workspace: editor.workspace,
  }));
  const hasSavedProjects = (workspace?.projects.length ?? 0) > 0;

  const handleConfirmDeleteAllEdits = () => {
    if (!hasSavedProjects) {
      return;
    }

    void deleteAllProjects();
  };

  return (
    <EditorDeleteAction
      confirmDescription="This will remove every saved editor edit. Source recordings and clips will not be deleted."
      confirmLabel="Delete all edits"
      confirmTitle="Delete all edits?"
      disabled={!hasSavedProjects}
      label="Delete all edits"
      onConfirm={handleConfirmDeleteAllEdits}
    />
  );
}

export { EditorDeleteAllEditsAction };
