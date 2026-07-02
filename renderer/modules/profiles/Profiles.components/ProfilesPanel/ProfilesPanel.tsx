import {
  ProfileManagementPanel,
  type ProfileManagementPanelItem,
} from "~/renderer/components/ProfileManagementPanel/ProfileManagementPanel";
import { sortProfilesForDisplay } from "~/renderer/modules/profiles/Profiles.utils/Profiles.utils";
import { useProfilesShallow } from "~/renderer/store";

function ProfilesPanel() {
  const {
    createProfile,
    deleteProfile,
    items,
    selectedProfileId,
    selectProfile,
  } = useProfilesShallow((profiles) => ({
    createProfile: profiles.create,
    deleteProfile: profiles.delete,
    items: profiles.items,
    selectedProfileId: profiles.selectedProfileId,
    selectProfile: profiles.select,
  }));
  const panelItems: ProfileManagementPanelItem[] = sortProfilesForDisplay(
    items,
  ).map((profile) => ({
    columns: [profile.game, `${profile.targetFps} FPS`],
    id: profile.id,
    isDeleteDisabled: items.length <= 1,
    isSelected: profile.id === selectedProfileId,
    name: profile.name,
  }));

  const handleCreateProfile = (name: string) => {
    void createProfile(name);
  };
  const handleSelectProfile = (profileId: string) => {
    selectProfile(profileId);
  };
  const handleDeleteProfile = (profileId: string) => {
    void deleteProfile(profileId);
  };

  return (
    <ProfileManagementPanel
      count={items.length}
      emptyMessage="No profiles yet."
      initialName="Default PoE Overlay"
      inputLabel="Aura profile name"
      items={panelItems}
      rowGridClassName="grid-cols-[minmax(0,1fr)_90px_72px_32px]"
      title="Aura Profiles"
      onCreate={handleCreateProfile}
      onDelete={handleDeleteProfile}
      onSelect={handleSelectProfile}
    />
  );
}

export { ProfilesPanel };
