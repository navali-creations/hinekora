import { useEffect } from "react";

import { useAuraProfileSave } from "~/renderer/modules/crop-editor/CropEditor.hooks/useAuraProfileSave/useAuraProfileSave";
import { getSelectedProfile } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { isKeyboardShortcutEditableTarget } from "~/renderer/modules/keyboard-shortcuts/KeyboardShortcuts.utils/KeyboardShortcuts.utils";
import {
  useCropEditorShallow,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

function useAuraProfileKeyboardShortcuts(): void {
  const { openProfileActionDialog, profileActionDialog } = useCropEditorShallow(
    (cropEditor) => ({
      openProfileActionDialog: cropEditor.openProfileActionDialog,
      profileActionDialog: cropEditor.profileActionDialog,
    }),
  );
  const { profileItems, selectedProfileId } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
    }),
  );
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const profile = getSelectedProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
  const saveProfile = useAuraProfileSave(profile?.id ?? null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        profileActionDialog ||
        event.altKey ||
        event.shiftKey ||
        !(event.ctrlKey || event.metaKey)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!["d", "e", "n", "s"].includes(key)) {
        return;
      }
      if (key !== "s" && isKeyboardShortcutEditableTarget(event.target)) {
        return;
      }

      if (key === "n") {
        event.preventDefault();
        openProfileActionDialog("create");
        return;
      }
      if (!profile) {
        return;
      }

      event.preventDefault();
      if (key === "e") {
        openProfileActionDialog("edit");
      } else if (key === "d") {
        openProfileActionDialog("delete-current");
      } else {
        saveProfile();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [openProfileActionDialog, profile, profileActionDialog, saveProfile]);
}

export { useAuraProfileKeyboardShortcuts };
