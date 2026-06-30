import clsx from "clsx";
import { FiFilePlus } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import { EditorShortcutCombo } from "../EditorShortcutCombo/EditorShortcutCombo";

interface EditorNewEditActionProps {
  disabled?: boolean;
  variant?: "button" | "menu";
}

function EditorNewEditAction({
  disabled = false,
  variant = "button",
}: EditorNewEditActionProps) {
  const { createProject } = useEditorShallow((editor) => ({
    createProject: editor.createProject,
  }));

  const handleCreateNewEdit = () => {
    if (disabled) {
      return;
    }

    void createProject({ assetKeys: [] });
  };

  return (
    <button
      className={clsx(
        "no-drag",
        variant === "menu"
          ? "flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300 disabled:cursor-not-allowed disabled:opacity-45"
          : "btn btn-ghost btn-sm",
      )}
      disabled={disabled}
      type="button"
      onClick={handleCreateNewEdit}
    >
      New edit
      {variant === "menu" ? (
        <EditorShortcutCombo keys={["Ctrl", "N"]} />
      ) : (
        <FiFilePlus size={15} />
      )}
    </button>
  );
}

export { EditorNewEditAction };
