import clsx from "clsx";
import { FiFilePlus } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

interface EditorNewEditActionProps {
  variant?: "button" | "menu";
}

function EditorNewEditAction({ variant = "button" }: EditorNewEditActionProps) {
  const { createProject } = useEditorShallow((editor) => ({
    createProject: editor.createProject,
  }));

  const handleCreateNewEdit = () => {
    void createProject({ assetKeys: [] });
  };

  return (
    <button
      className={clsx(
        "no-drag",
        variant === "menu"
          ? "flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300"
          : "btn btn-ghost btn-sm",
      )}
      type="button"
      onClick={handleCreateNewEdit}
    >
      New edit
      <FiFilePlus size={15} />
    </button>
  );
}

export { EditorNewEditAction };
