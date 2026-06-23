import { useCallback, useEffect, useRef, useState } from "react";

import { createAuraProfileUpdateFromSelection } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface StartAddAuraSelectionOptions {
  lockOnCancel?: boolean;
}

interface UseAuraOverlayAddAuraSelectionInput {
  lockAuraOverlay: () => Promise<void>;
  profile: Profile | null;
  recordAuraHistory: () => boolean;
  routeAddAuraRequestId: string | null;
  routeStartAddingAura: boolean;
  updateProfile: UpdateProfile;
}

function useAuraOverlayAddAuraSelection({
  lockAuraOverlay,
  profile,
  recordAuraHistory,
  routeAddAuraRequestId,
  routeStartAddingAura,
  updateProfile,
}: UseAuraOverlayAddAuraSelectionInput) {
  const [addAuraRequestId, setAddAuraRequestId] = useState<string | null>(null);
  const [addingAura, setAddingAura] = useState(false);
  const handledAddAuraRequestRef = useRef<string | null>(null);
  const addingAuraRef = useRef(false);

  useEffect(
    () =>
      window.electron.overlayWindows.onAuraAddRequested(setAddAuraRequestId),
    [],
  );

  const startAddAuraSelection = useCallback(
    (options?: StartAddAuraSelectionOptions) => {
      if (!profile || addingAuraRef.current) {
        return false;
      }

      const lockOnCancel = options?.lockOnCancel === true;
      addingAuraRef.current = true;
      setAddingAura(true);
      void window.electron.overlayWindows
        .selectCropRegion()
        .then(async (selection) => {
          if (!selection) {
            if (lockOnCancel) {
              await lockAuraOverlay();
            }
            return;
          }

          const { profileUpdate } = createAuraProfileUpdateFromSelection(
            profile,
            selection,
          );

          recordAuraHistory();
          await updateProfile(profileUpdate);
        })
        .catch(() => {
          if (lockOnCancel) {
            void lockAuraOverlay();
          }
        })
        .finally(() => {
          addingAuraRef.current = false;
          setAddingAura(false);
        });

      return true;
    },
    [lockAuraOverlay, profile, recordAuraHistory, updateProfile],
  );

  useEffect(() => {
    const requestId = routeStartAddingAura
      ? (routeAddAuraRequestId ?? "initial")
      : addAuraRequestId;
    if (!requestId || !profile) {
      return;
    }

    if (handledAddAuraRequestRef.current === requestId) {
      return;
    }

    if (startAddAuraSelection({ lockOnCancel: true })) {
      handledAddAuraRequestRef.current = requestId;
    }
  }, [
    addAuraRequestId,
    profile,
    routeAddAuraRequestId,
    routeStartAddingAura,
    startAddAuraSelection,
  ]);

  return {
    addingAura,
    startAddAuraSelection,
  };
}

export { useAuraOverlayAddAuraSelection };
