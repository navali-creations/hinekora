import clsx from "clsx";
import type { ChangeEvent } from "react";

import { useEditorShallow, useSettingsShallow } from "~/renderer/store";

interface EditorProjectRetentionToggleProps {
  disabled?: boolean;
}

function EditorProjectRetentionToggle({
  disabled = false,
}: EditorProjectRetentionToggleProps) {
  const { error, isEnabled, updatePreference } = useSettingsShallow(
    (settings) => ({
      error: settings.preferenceErrors.editorAutoPruneProjects ?? null,
      isEnabled: settings.value?.editorAutoPruneProjects ?? true,
      updatePreference: settings.updatePreference,
    }),
  );
  const refreshMedia = useEditorShallow((editor) => editor.refreshMedia);

  const handleToggleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const didSave = await updatePreference(
      "editorAutoPruneProjects",
      event.target.checked,
    );
    if (didSave) {
      await refreshMedia();
    }
  };

  return (
    <label
      className={clsx(
        "flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm transition-colors hover:bg-base-300",
        { "cursor-not-allowed opacity-50": disabled },
      )}
      title="Automatically delete draft edits older than the latest five."
    >
      <span className="min-w-0 truncate">
        Auto-prune all but last 5
        {error ? (
          <span className="ml-1 text-error text-xs" role="status">
            {error}
          </span>
        ) : null}
      </span>
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
