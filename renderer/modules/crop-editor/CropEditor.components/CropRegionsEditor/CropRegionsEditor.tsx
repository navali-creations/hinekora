import type { ChangeEvent, MouseEvent } from "react";
import { FiTrash2 as Trash2 } from "react-icons/fi";

import {
  type CropNumberField,
  clamp,
  cropNumberFields,
  getSelectedProfile,
  isCropNumberField,
  resolveActiveAuraCropRegionId,
} from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { useCropEditorShallow, useProfilesShallow } from "~/renderer/store";

const cropFieldLabels: Record<CropNumberField, string> = {
  x: "screen x",
  y: "screen y",
  width: "width",
  height: "height",
};

function CropRegionsEditor() {
  const { profileItems, selectedProfileId, updateProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      updateProfile: profiles.update,
    }),
  );
  const { selectAura, selectedAuraCropRegionId } = useCropEditorShallow(
    (cropEditor) => ({
      selectAura: cropEditor.selectAura,
      selectedAuraCropRegionId: cropEditor.selectedAuraCropRegionId,
    }),
  );
  const profile = getSelectedProfile(profileItems, selectedProfileId);
  const activeAuraCropRegionId = resolveActiveAuraCropRegionId(
    profile,
    selectedAuraCropRegionId,
  );
  const activeRegions =
    profile && activeAuraCropRegionId
      ? profile.cropRegions.filter(
          (region) => region.id === activeAuraCropRegionId,
        )
      : [];

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!profile) {
      return;
    }

    const regionId = event.currentTarget.dataset.regionId;
    const label = event.currentTarget.value.trim();
    if (!regionId || label.length === 0) {
      return;
    }

    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === regionId ? { ...region, label } : region,
      ),
    });
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!profile) {
      return;
    }

    const regionId = event.currentTarget.dataset.regionId;
    const field = event.currentTarget.dataset.field;
    const nextValue = Number(event.currentTarget.value);
    if (!regionId || !isCropNumberField(field) || !Number.isFinite(nextValue)) {
      return;
    }

    const minimum = field === "width" || field === "height" ? 1 : 0;
    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === regionId
          ? {
              ...region,
              [field]: clamp(Math.round(nextValue), minimum, 100_000),
            }
          : region,
      ),
    });
  };

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    if (!profile) {
      return;
    }

    const regionId = event.currentTarget.dataset.regionId;
    if (!regionId) {
      return;
    }

    const cropRegions = profile.cropRegions.filter(
      (region) => region.id !== regionId,
    );
    void updateProfile({
      id: profile.id,
      cropRegions,
      overlayPlacements: profile.overlayPlacements.filter(
        (placement) => placement.cropRegionId !== regionId,
      ),
    });
    selectAura(cropRegions[0]?.id ?? null);
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="grid content-start gap-2">
      {activeRegions.map((region) => (
        <div
          className="grid grid-cols-2 items-end gap-2 rounded-md bg-base-200 p-2"
          key={region.id}
        >
          <div className="col-span-2 flex items-center justify-between gap-2">
            <h3 className="m-0 font-bold text-primary text-xs">Source Area</h3>
            <button
              aria-label="Delete source area"
              className="btn btn-primary btn-square btn-xs"
              data-region-id={region.id}
              title="Delete source area"
              type="button"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <label className="col-span-2 grid gap-1 text-primary text-xs">
            name
            <input
              className="input input-bordered input-xs min-w-0 w-full"
              data-region-id={region.id}
              defaultValue={region.label}
              onBlur={handleLabelChange}
            />
          </label>
          {cropNumberFields.map((field) => (
            <label className="grid gap-1 text-primary text-xs" key={field}>
              {cropFieldLabels[field]}
              <input
                className="input input-bordered input-xs min-w-0 w-full"
                data-field={field}
                data-region-id={region.id}
                min={field === "width" || field === "height" ? 1 : 0}
                type="number"
                value={region[field]}
                onChange={handleNumberChange}
              />
            </label>
          ))}
        </div>
      ))}
      {profile.cropRegions.length === 0 && (
        <p className="m-0 text-base-content/60 text-xs">
          No source area configured.
        </p>
      )}
    </div>
  );
}

export { CropRegionsEditor };
