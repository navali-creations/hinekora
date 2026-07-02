import type { ChangeEvent } from "react";

import {
  getCaptureProfileDisplayName,
  sortCaptureProfilesForDisplay,
} from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { useCaptureProfilesShallow } from "~/renderer/store";

import { CaptureProfileLockToggle } from "../CaptureProfileLockToggle/CaptureProfileLockToggle";

function CaptureProfileSelect() {
  const { items, selectedProfileId, selectProfileWithPreviewSource } =
    useCaptureProfilesShallow((captureProfiles) => ({
      items: captureProfiles.items,
      selectedProfileId: captureProfiles.selectedProfileId,
      selectProfileWithPreviewSource: captureProfiles.selectWithPreviewSource,
    }));

  const handleProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.target.value) {
      selectProfileWithPreviewSource(event.target.value);
    }
  };

  return (
    <div className="join" data-onboarding="capture-profiles">
      <select
        aria-label="Capture profile"
        className="join-item select select-bordered select-sm w-48 bg-base-200 focus:outline-none focus-visible:outline-none"
        disabled={items.length === 0}
        value={selectedProfileId ?? ""}
        onChange={handleProfileChange}
      >
        {items.length === 0 && <option value="">Default profile</option>}
        {sortCaptureProfilesForDisplay(items).map((profile) => (
          <option key={profile.id} value={profile.id}>
            {getCaptureProfileDisplayName(profile)}
          </option>
        ))}
      </select>
      <CaptureProfileLockToggle attached />
    </div>
  );
}

export { CaptureProfileSelect };
