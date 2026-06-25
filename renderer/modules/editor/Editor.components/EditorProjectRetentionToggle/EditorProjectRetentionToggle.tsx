import clsx from "clsx";
import type { ChangeEvent } from "react";

import { useEditorShallow, useSettingsShallow } from "~/renderer/store";

interface EditorProjectRetentionToggleProps {
  disabled?: boolean;
}

function EditorProjectRetentionToggle({
  disabled = false,
}: EditorProjectRetentionToggleProps) {
  const { isEnabled, updateSettings } = useSettingsShallow((settings) => ({
    isEnabled: settings.value?.editorAutoPruneProjects ?? false,
    updateSettings: settings.update,
  }));
  const refreshMedia = useEditorShallow((editor) => editor.refreshMedia);

  const handleToggleChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updateSettings({
      editorAutoPruneProjects: event.target.checked,
    }).then(() => refreshMedia());
  };

  return (
    <label
      className={clsx(
        "flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm transition-colors hover:bg-base-300",
        disabled && "cursor-not-allowed opacity-50",
      )}
      title="Automatically delete saved edits older than the latest five."
    >
      <span className="min-w-0 truncate">Auto-prune all but last 5</span>
      <input
        aria-label="Auto-prune all but last 5 edits"
        checked={isEnabled}
        className="toggle toggle-primary toggle-xs"
        disabled={disabled}
        type="checkbox"
        onChange={handleToggleChange}
      />
    </label>
  );
}

export { EditorProjectRetentionToggle };
