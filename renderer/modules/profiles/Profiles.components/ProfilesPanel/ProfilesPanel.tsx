import clsx from "clsx";
import type { ChangeEvent, MouseEvent } from "react";
import { useState } from "react";
import { FiPlus as Plus } from "react-icons/fi";

import { useProfilesShallow } from "~/renderer/store";

function ProfilesPanel() {
  const { createProfile, items, selectedProfileId, selectProfile } =
    useProfilesShallow((profiles) => ({
      createProfile: profiles.create,
      items: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      selectProfile: profiles.select,
    }));
  const [name, setName] = useState("Default PoE Overlay");

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };
  const handleCreate = () => {
    if (name.trim()) {
      void createProfile(name.trim());
    }
  };
  const handleSelectProfile = (event: MouseEvent<HTMLButtonElement>) => {
    const profileId = event.currentTarget.dataset.profileId;
    if (profileId) {
      selectProfile(profileId);
    }
  };

  return (
    <section className="col-span-5 grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">Profiles</h2>
        <span>{items.length}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input input-bordered min-w-0 flex-1"
          value={name}
          onChange={handleNameChange}
        />
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleCreate}
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      <div className="grid gap-1.5">
        {items.map((profile) => (
          <button
            className={clsx(
              "grid min-h-[34px] w-full grid-cols-[minmax(0,1fr)_90px_96px] items-center gap-3 rounded-md border px-3 py-2 text-left text-base-content",
              profile.id === selectedProfileId
                ? "border-primary bg-primary/25"
                : "border-transparent bg-base-200",
            )}
            data-profile-id={profile.id}
            key={profile.id}
            type="button"
            onClick={handleSelectProfile}
          >
            <span>{profile.name}</span>
            <span>{profile.game}</span>
            <span>{profile.targetFps} FPS</span>
          </button>
        ))}
        {items.length === 0 && (
          <p className="m-0 text-base-content/60">No profiles yet.</p>
        )}
      </div>
    </section>
  );
}

export { ProfilesPanel };
