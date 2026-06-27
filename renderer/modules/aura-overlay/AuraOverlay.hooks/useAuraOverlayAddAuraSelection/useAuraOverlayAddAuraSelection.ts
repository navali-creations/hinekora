import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AuraAddRequest,
  CropRegionSelectionShape,
} from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { createAuraProfileUpdateFromSelection } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface StartAddAuraSelectionOptions {
  shape?: CropRegionSelectionShape;
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
  const [addAuraRequest, setAddAuraRequest] = useState<AuraAddRequest | null>(
    null,
  );
  const [addingAura, setAddingAura] = useState(false);
  const handledAddAuraRequestRef = useRef<string | null>(null);
  const addingAuraRef = useRef(false);

  useEffect(
    () => window.electron.overlayWindows.onAuraAddRequested(setAddAuraRequest),
    [],
  );

  const startAddAuraSelection = useCallback(
    (options?: StartAddAuraSelectionOptions) => {
      if (!profile || addingAuraRef.current) {
        return false;
      }

      const lockOnCancel = options?.lockOnCancel === true;
      const shape = options?.shape ?? "rect";
      addingAuraRef.current = true;
      setAddingAura(true);
      void window.electron.overlayWindows
        .selectCropRegion({ shape })
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
      : addAuraRequest?.requestId;
    if (!requestId || !profile) {
      return;
    }

    if (handledAddAuraRequestRef.current === requestId) {
      return;
    }

    const shape = routeStartAddingAura
      ? readRouteAddAuraShape()
      : (addAuraRequest?.shape ?? "rect");

    if (startAddAuraSelection({ lockOnCancel: true, shape })) {
      handledAddAuraRequestRef.current = requestId;
    }
  }, [
    addAuraRequest,
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

function readRouteAddAuraShape(): CropRegionSelectionShape {
  return new URLSearchParams(window.location.hash.split("?")[1] ?? "").get(
    "addAuraShape",
  ) === "arc"
    ? "arc"
    : "rect";
}

export { useAuraOverlayAddAuraSelection };
