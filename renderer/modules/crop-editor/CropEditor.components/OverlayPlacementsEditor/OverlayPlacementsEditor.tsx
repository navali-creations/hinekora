import type { ChangeEvent } from "react";

import {
  clamp,
  getSelectedProfile,
  isPlacementNumberField,
  type PlacementNumberField,
  placementNumberFields,
  resolveActiveAuraCropRegionId,
} from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { useCropEditorShallow, useProfilesShallow } from "~/renderer/store";

const placementFieldLabels: Record<PlacementNumberField, string> = {
  x: "left",
  y: "top",
  scale: "size",
  opacity: "opacity",
};

function OverlayPlacementsEditor() {
  const { profileItems, selectedProfileId, updateProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      updateProfile: profiles.update,
    }),
  );
  const selectedAuraCropRegionId = useCropEditorShallow(
    (cropEditor) => cropEditor.selectedAuraCropRegionId,
  );
  const profile = getSelectedProfile(profileItems, selectedProfileId);
  const activeAuraCropRegionId = resolveActiveAuraCropRegionId(
    profile,
    selectedAuraCropRegionId,
  );
  const activePlacements =
    profile && activeAuraCropRegionId
      ? profile.overlayPlacements.filter(
          (placement) => placement.cropRegionId === activeAuraCropRegionId,
        )
      : [];

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!profile) {
      return;
    }

    const placementId = event.currentTarget.dataset.placementId;
    const field = event.currentTarget.dataset.field;
    const nextValue = Number(event.currentTarget.value);
    if (
      !placementId ||
      !isPlacementNumberField(field) ||
      !Number.isFinite(nextValue)
    ) {
      return;
    }

    const normalized =
      field === "scale"
        ? clamp(nextValue, 0.1, 8)
        : field === "opacity"
          ? clamp(nextValue, 0, 1)
          : clamp(Math.round(nextValue), -100_000, 100_000);

    void updateProfile({
      id: profile.id,
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId
          ? { ...placement, [field]: normalized }
          : placement,
      ),
    });
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="grid content-start gap-2">
      {activePlacements.map((placement) => (
        <div
          className="grid grid-cols-2 items-end gap-2 rounded-md bg-base-200 p-2"
          key={placement.id}
        >
          <h3 className="col-span-2 m-0 font-bold text-primary text-xs">
            Aura Position
          </h3>
          {placementNumberFields.map((field) => (
            <label className="grid gap-1 text-primary text-xs" key={field}>
              {placementFieldLabels[field]}
              <input
                className="input input-bordered input-xs min-w-0 w-full"
                data-field={field}
                data-placement-id={placement.id}
                max={field === "opacity" ? 1 : undefined}
                min={field === "scale" ? 0.1 : undefined}
                step={field === "scale" || field === "opacity" ? 0.05 : 1}
                type="number"
                value={placement[field]}
                onChange={handleNumberChange}
              />
            </label>
          ))}
        </div>
      ))}
      {activePlacements.length === 0 && (
        <p className="m-0 text-base-content/60 text-xs">
          No aura position configured.
        </p>
      )}
    </div>
  );
}

export { OverlayPlacementsEditor };
