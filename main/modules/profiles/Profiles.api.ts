import { ipcRenderer } from "electron";

import type { Profile, ProfileCreateInput, ProfileUpdateInput } from "~/types";
import { ProfilesChannel } from "./Profiles.channels";

const ProfilesAPI = {
  list: (): Promise<Profile[]> => ipcRenderer.invoke(ProfilesChannel.List),
  create: (input: ProfileCreateInput): Promise<Profile> =>
    ipcRenderer.invoke(ProfilesChannel.Create, input),
  update: (input: ProfileUpdateInput): Promise<Profile> =>
    ipcRenderer.invoke(ProfilesChannel.Update, input),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(ProfilesChannel.Delete, id),
  onChanged: (callback: (profiles: Profile[]) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      profiles: Profile[],
    ) => {
      callback(profiles);
    };

    ipcRenderer.on(ProfilesChannel.Changed, listener);

    return () => ipcRenderer.removeListener(ProfilesChannel.Changed, listener);
  },
};

export { ProfilesAPI };
