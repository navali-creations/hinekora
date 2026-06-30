import { useEffect, useState } from "react";

import { EditorDeleteConfirmationModal } from "../EditorDeleteConfirmationModal/EditorDeleteConfirmationModal";
import { EditorShortcutCombo } from "../EditorShortcutCombo/EditorShortcutCombo";

interface EditorDeleteActionProps {
  confirmDescription: string;
  confirmLabel: string;
  confirmTitle: string;
  disabled: boolean;
  label: string;
  shortcutKeys?: string[];
  shortcutEventName?: string;
  onConfirm: () => void;
}

function EditorDeleteAction({
  confirmDescription,
  confirmLabel,
  confirmTitle,
  disabled,
  label,
  shortcutKeys,
  shortcutEventName,
  onConfirm,
}: EditorDeleteActionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleOpenConfirm = () => {
    if (disabled) {
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleCloseConfirm = () => {
    setIsConfirmOpen(false);
  };

  const handleConfirm = () => {
    if (!disabled) {
      onConfirm();
    }

    setIsConfirmOpen(false);
  };

  useEffect(() => {
    if (!shortcutEventName) {
      return;
    }

    const handleShortcutOpenConfirm = () => {
      if (disabled) {
        return;
      }

      setIsConfirmOpen(true);
    };

    window.addEventListener(shortcutEventName, handleShortcutOpenConfirm);

    return () => {
      window.removeEventListener(shortcutEventName, handleShortcutOpenConfirm);
    };
  }, [disabled, shortcutEventName]);

  return (
    <>
      <button
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-red-400 text-sm transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-red-400/55 disabled:opacity-100"
        disabled={disabled}
        type="button"
        onClick={handleOpenConfirm}
      >
        <span>{label}</span>
        {shortcutKeys && <EditorShortcutCombo keys={shortcutKeys} />}
      </button>
      <EditorDeleteConfirmationModal
        confirmLabel={confirmLabel}
        description={confirmDescription}
        isOpen={isConfirmOpen}
        title={confirmTitle}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export { EditorDeleteAction };
