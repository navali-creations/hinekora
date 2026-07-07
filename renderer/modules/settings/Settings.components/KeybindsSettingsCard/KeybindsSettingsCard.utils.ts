import { editorShortcutItems } from "~/renderer/modules/editor/Editor.utils/EditorShortcuts.utils";

import {
  Keybind,
  type KeybindAction,
  type KeybindSettingKey,
  keybindActionConfigs,
  keybindActions,
  type ManagedRecorderStatus,
} from "~/types";
import type { KeybindsSettingsRecorderStatusState } from "./useKeybindsSettingsRecorderStatus/useKeybindsSettingsRecorderStatus";

type KeybindSettingsValue = Partial<Record<KeybindSettingKey, string | null>>;

interface InternalKeybindConfig {
  accelerators: string[];
  id: string;
  label: string;
  scope: "Aura" | "Crop" | "Editor" | "Timeline";
}

interface GlobalKeybindConflict {
  label: string;
}

const internalKeybindConfigs: InternalKeybindConfig[] = [
  ...editorShortcutItems.map(
    (item, index): InternalKeybindConfig => ({
      accelerators: createInternalShortcutAccelerators(item.keys),
      id: `editor-shortcut-${index}`,
      label: trimTrailingPeriod(item.label),
      scope: item.category === "timeline" ? "Timeline" : "Editor",
    }),
  ),
  {
    accelerators: ["Esc"],
    id: "editor-clear-selected-bookmark",
    label: "Clear the selected recording bookmark",
    scope: "Editor",
  },
  {
    accelerators: ["Esc"],
    id: "aura-lock-overlay",
    label: "Lock the aura overlay",
    scope: "Aura",
  },
  {
    accelerators: ["Ctrl+Z", "Meta+Z"],
    id: "aura-undo-placement-edit",
    label: "Undo the last aura edit",
    scope: "Aura",
  },
  {
    accelerators: ["Ctrl+Y", "Meta+Y", "Ctrl+Shift+Z", "Meta+Shift+Z"],
    id: "aura-redo-placement-edit",
    label: "Redo the last undone aura edit",
    scope: "Aura",
  },
  {
    accelerators: ["Delete", "Backspace"],
    id: "aura-delete-selected-placement",
    label: "Delete the selected aura placement",
    scope: "Aura",
  },
  {
    accelerators: ["Esc"],
    id: "crop-cancel-selection",
    label: "Cancel crop region selection",
    scope: "Crop",
  },
  {
    accelerators: ["Return"],
    id: "crop-complete-point-selection",
    label: "Complete polygon crop selection",
    scope: "Crop",
  },
];

function findDuplicateAction(
  action: KeybindAction,
  accelerator: string,
  settingsValue: KeybindSettingsValue | null | undefined,
): KeybindAction | null {
  for (const candidate of keybindActions) {
    if (candidate === action) {
      continue;
    }

    const candidateKeybind = Keybind.tryParse(
      readSavedAccelerator(settingsValue, candidate),
    );
    if (candidateKeybind?.toElectronAccelerator() === accelerator) {
      return candidate;
    }
  }

  return null;
}

function findInternalGlobalConflict(
  accelerators: string[],
  settingsValue: KeybindSettingsValue | null | undefined,
): GlobalKeybindConflict | null {
  const internalAccelerators = new Set(
    accelerators
      .map((accelerator) =>
        Keybind.tryParse(accelerator)?.toElectronAccelerator(),
      )
      .filter((accelerator): accelerator is string => Boolean(accelerator)),
  );

  if (internalAccelerators.size === 0) {
    return null;
  }

  for (const action of keybindActions) {
    const keybind = Keybind.tryParse(
      readSavedAccelerator(settingsValue, action),
    );
    if (!keybind) {
      continue;
    }

    const accelerator = keybind.toElectronAccelerator();
    if (internalAccelerators.has(accelerator)) {
      return {
        label: keybindActionConfigs[action].label,
      };
    }
  }

  return null;
}

function formatInternalAccelerator(accelerator: string): string {
  return (
    Keybind.tryParse(accelerator)?.toDisplayLabel() ??
    accelerator
      .split("+")
      .map((part) => part.trim().toUpperCase())
      .join(" + ")
  );
}

function readActionDataset(value: string | undefined): KeybindAction | null {
  return keybindActions.find((action) => action === value) ?? null;
}

function readSavedAccelerator(
  settingsValue: KeybindSettingsValue | null | undefined,
  action: KeybindAction,
): string | null {
  const config = keybindActionConfigs[action];
  if (settingsValue && Object.hasOwn(settingsValue, config.settingKey)) {
    return settingsValue[config.settingKey] ?? null;
  }

  return config.defaultAccelerator;
}

function resolveStatusText(error: string | null): string | null {
  if (!error || error === "No keybind set" || error === "Not registered") {
    return null;
  }

  return error;
}

function isKeybindEditingDisabled(
  status: ManagedRecorderStatus | null,
  state: KeybindsSettingsRecorderStatusState,
): boolean {
  return (
    state !== "ready" ||
    status?.bufferActive === true ||
    status?.runRecordingActive === true
  );
}

function resolveKeybindEditingDisabledMessage(
  status: ManagedRecorderStatus | null,
  state: KeybindsSettingsRecorderStatusState,
): string | null {
  if (state === "loading") {
    return "Checking recorder status. Keybind editing is disabled until status is ready.";
  }
  if (state === "error") {
    return "Unable to load recorder status. Keybind editing is disabled while status is unavailable.";
  }

  const isRecordingActive = status?.runRecordingActive === true;
  const isRewindActive = status?.bufferActive === true;

  if (isRecordingActive && isRewindActive) {
    return "Recording and rewind are active. Stop them before changing global shortcuts.";
  }
  if (isRecordingActive) {
    return "Recording is active. Stop recording before changing global shortcuts.";
  }
  if (isRewindActive) {
    return "Rewind is active. Stop rewind before changing global shortcuts.";
  }

  return null;
}

function trimTrailingPeriod(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function createInternalShortcutAccelerators(keys: string[]): string[] {
  const accelerator = keys.join("+");
  if (!keys.includes("Ctrl") || keys.includes("Wheel")) {
    return [accelerator];
  }

  return [
    accelerator,
    keys.map((key) => (key === "Ctrl" ? "Meta" : key)).join("+"),
  ];
}

export type { KeybindSettingsValue };
export {
  findDuplicateAction,
  findInternalGlobalConflict,
  formatInternalAccelerator,
  internalKeybindConfigs,
  isKeybindEditingDisabled,
  readActionDataset,
  readSavedAccelerator,
  resolveKeybindEditingDisabledMessage,
  resolveStatusText,
};
