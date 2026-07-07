import { useEffect, useState } from "react";

import type { KeybindRegistrationStatus } from "~/main/modules/keybinds";

const keybindStatusLoadError = "Unable to load keybind status.";

function useKeybindsSettingsRegistrationStatus(): {
  registrationStatus: KeybindRegistrationStatus | null;
  registrationStatusLoadError: string | null;
} {
  const [registrationStatus, setRegistrationStatus] =
    useState<KeybindRegistrationStatus | null>(null);
  const [registrationStatusLoadError, setRegistrationStatusLoadError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const handleStatusChanged = (status: KeybindRegistrationStatus) => {
      if (!active) {
        return;
      }

      setRegistrationStatus(status);
      setRegistrationStatusLoadError(null);
    };

    void window.electron.keybinds
      .getStatus()
      .then(handleStatusChanged)
      .catch(() => {
        if (active) {
          setRegistrationStatusLoadError(keybindStatusLoadError);
        }
      });
    const unsubscribe =
      window.electron.keybinds.onStatusChanged(handleStatusChanged);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { registrationStatus, registrationStatusLoadError };
}

export { useKeybindsSettingsRegistrationStatus };
