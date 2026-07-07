import type { KeybindRegistrationStatus } from "../../main/modules/keybinds";
import { Keybind, keybindActionConfigs, keybindActions } from "../../types";

function createDefaultKeybindRegistrationStatus(): KeybindRegistrationStatus {
  return keybindActions.reduce((status, action) => {
    const keybind = new Keybind(
      keybindActionConfigs[action].defaultAccelerator,
    );
    status[action] = {
      accelerator: keybind.toElectronAccelerator(),
      displayLabel: keybind.toDisplayLabel(),
      error: null,
      registered: true,
    };

    return status;
  }, {} as KeybindRegistrationStatus);
}

export { createDefaultKeybindRegistrationStatus };
