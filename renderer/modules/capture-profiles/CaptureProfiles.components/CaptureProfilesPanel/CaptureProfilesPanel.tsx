import {
  ProfileManagementPanel,
  type ProfileManagementPanelItem,
} from "~/renderer/components/ProfileManagementPanel/ProfileManagementPanel";
import {
  getCaptureProfileDisplayName,
  isDefaultCaptureProfile,
  sortCaptureProfilesForDisplay,
} from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { useCaptureProfilesShallow } from "~/renderer/store";

function CaptureProfilesPanel() {
  const {
    createProfile,
    deleteProfile,
    items,
    selectedProfileId,
    selectProfileWithPreviewSource,
  } = useCaptureProfilesShallow((captureProfiles) => ({
    createProfile: captureProfiles.create,
    deleteProfile: captureProfiles.delete,
    items: captureProfiles.items,
    selectedProfileId: captureProfiles.selectedProfileId,
    selectProfileWithPreviewSource: captureProfiles.selectWithPreviewSource,
  }));
  const panelItems: ProfileManagementPanelItem[] =
    sortCaptureProfilesForDisplay(items).map((profile) => {
      const name = getCaptureProfileDisplayName(profile);
      const isDeleteDisabled =
        items.length <= 1 || isDefaultCaptureProfile(profile);

      return {
        columns: [profile.game],
        ...(isDefaultCaptureProfile(profile)
          ? {
              deleteDisabledTitle: "Default capture profiles cannot be deleted",
            }
          : {}),
        id: profile.id,
        isDeleteDisabled,
        isSelected: profile.id === selectedProfileId,
        name,
      };
    });

  const handleCreateProfile = (name: string) => {
    void createProfile(name);
  };
  const handleSelectProfile = (profileId: string) => {
    selectProfileWithPreviewSource(profileId);
  };
  const handleDeleteProfile = (profileId: string) => {
    void deleteProfile(profileId);
  };

  return (
    <ProfileManagementPanel
      count={items.length}
      emptyMessage="Default profile will be recreated automatically."
      initialName="Default Capture"
      inputLabel="Capture profile name"
      items={panelItems}
      rowGridClassName="grid-cols-[minmax(0,1fr)_90px_32px]"
      title="Capture Profiles"
      onCreate={handleCreateProfile}
      onDelete={handleDeleteProfile}
      onSelect={handleSelectProfile}
    />
  );
}

export { CaptureProfilesPanel };
