import { type MouseEvent as ReactMouseEvent, useEffect, useState } from "react";

import {
  type AppSettings,
  Keybind,
  type KeybindAction,
  type KeybindUserInput,
  keybindActionConfigs,
} from "~/types";
import {
  findDuplicateAction,
  type KeybindSettingsValue,
  readActionDataset,
} from "../KeybindsSettingsCard.utils";

interface UseKeybindsSettingsCaptureParams {
  editingDisabled: boolean;
  keybindSettingsValue: KeybindSettingsValue | null;
  updateSettings: (settings: Partial<AppSettings>) => unknown;
}

interface UseKeybindsSettingsCaptureResult {
  activeAction: KeybindAction | null;
  activePreview: string;
  captureError: string | null;
  handleClearClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  handleRecordClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  handleResetClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

function useKeybindsSettingsCapture({
  editingDisabled,
  keybindSettingsValue,
  updateSettings,
}: UseKeybindsSettingsCaptureParams): UseKeybindsSettingsCaptureResult {
  const [activeAction, setActiveAction] = useState<KeybindAction | null>(null);
  const [activePreview, setActivePreview] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    if (editingDisabled && activeAction) {
      setActiveAction(null);
      setActivePreview("");
      setCaptureError(null);
    }
  }, [activeAction, editingDisabled]);

  useEffect(() => {
    if (!activeAction || editingDisabled) {
      return;
    }

    const recordInput = (input: KeybindUserInput) => {
      setActivePreview(Keybind.previewUserInput(input));

      try {
        const keybind = Keybind.fromUserInput(input);
        if (!keybind) {
          return;
        }

        const duplicateAction = findDuplicateAction(
          activeAction,
          keybind.toElectronAccelerator(),
          keybindSettingsValue,
        );
        if (duplicateAction) {
          setCaptureError(
            `${keybindActionConfigs[duplicateAction].label} already uses ${keybind.toDisplayLabel()}.`,
          );
          return;
        }

        const settingKey = keybindActionConfigs[activeAction].settingKey;
        void updateSettings({
          [settingKey]: keybind.toElectronAccelerator(),
        } as Partial<AppSettings>);
        setActiveAction(null);
        setActivePreview("");
        setCaptureError(null);
      } catch (error) {
        setCaptureError(
          error instanceof Error ? error.message : "Unable to record keybind",
        );
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (isBareEscape(event)) {
        setActiveAction(null);
        setActivePreview("");
        setCaptureError(null);
        return;
      }

      recordInput(event);
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activeAction, editingDisabled, keybindSettingsValue, updateSettings]);

  const handleRecordClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (editingDisabled) {
      return;
    }

    const action = readActionDataset(event.currentTarget.dataset.action);
    if (!action) {
      return;
    }

    if (activeAction === action) {
      setActiveAction(null);
      setActivePreview("");
      setCaptureError(null);
      return;
    }

    setActiveAction(action);
    setActivePreview("");
    setCaptureError(null);
  };

  const handleClearClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (editingDisabled) {
      return;
    }

    const action = readActionDataset(event.currentTarget.dataset.action);
    if (!action) {
      return;
    }

    const settingKey = keybindActionConfigs[action].settingKey;
    void updateSettings({ [settingKey]: null } as Partial<AppSettings>);
    if (activeAction === action) {
      setActiveAction(null);
      setActivePreview("");
    }
    setCaptureError(null);
  };

  const handleResetClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (editingDisabled) {
      return;
    }

    const action = readActionDataset(event.currentTarget.dataset.action);
    if (!action) {
      return;
    }

    const config = keybindActionConfigs[action];
    void updateSettings({
      [config.settingKey]: config.defaultAccelerator,
    } as Partial<AppSettings>);
    if (activeAction === action) {
      setActiveAction(null);
      setActivePreview("");
    }
    setCaptureError(null);
  };

  return {
    activeAction,
    activePreview,
    captureError,
    handleClearClick,
    handleRecordClick,
    handleResetClick,
  };
}

function isBareEscape(event: KeyboardEvent): boolean {
  return (
    event.key === "Escape" &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

export { useKeybindsSettingsCapture };
