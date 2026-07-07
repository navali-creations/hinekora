import { useEffect, useState } from "react";

import type { ManagedRecorderStatus } from "~/types";

type KeybindsSettingsRecorderStatusState = "error" | "loading" | "ready";

interface KeybindsSettingsRecorderStatusResult {
  recorderStatus: ManagedRecorderStatus | null;
  recorderStatusState: KeybindsSettingsRecorderStatusState;
}

function useKeybindsSettingsRecorderStatus(): KeybindsSettingsRecorderStatusResult {
  const [recorderStatus, setRecorderStatus] =
    useState<ManagedRecorderStatus | null>(null);
  const [recorderStatusState, setRecorderStatusState] =
    useState<KeybindsSettingsRecorderStatusState>("loading");

  useEffect(() => {
    let active = true;
    const handleStatusChanged = (status: ManagedRecorderStatus) => {
      if (active) {
        setRecorderStatus(status);
        setRecorderStatusState("ready");
      }
    };

    void window.electron.managedRecorder
      .getStatus()
      .then(handleStatusChanged)
      .catch(() => {
        if (active) {
          setRecorderStatus(null);
          setRecorderStatusState("error");
        }
      });
    const unsubscribe =
      window.electron.managedRecorder.onStatusChanged(handleStatusChanged);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { recorderStatus, recorderStatusState };
}

export type { KeybindsSettingsRecorderStatusState };
export { useKeybindsSettingsRecorderStatus };
