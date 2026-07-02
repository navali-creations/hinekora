import { pickCaptureProfileSettingsUpdate } from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { trackEvent } from "~/renderer/modules/umami";
import type {
  BoundStore,
  BoundStoreStateCreator,
  SettingsSlice,
} from "~/renderer/store/store.types";

import type { AppSettings } from "~/types";

const untrackedSettingsUpdateKeys = new Set<keyof AppSettings>([
  "poe1CharacterName",
  "poe2CharacterName",
  "selectedCaptureProfileId",
  "selectedCaptureProfileIdsByGame",
  "selectedProfileId",
]);

function shouldTrackSettingsUpdate(input: Partial<AppSettings>): boolean {
  const updateKeys = Object.keys(input) as Array<keyof AppSettings>;

  return (
    updateKeys.length > 0 &&
    updateKeys.some((key) => !untrackedSettingsUpdateKeys.has(key))
  );
}

export const createSettingsSlice: BoundStoreStateCreator<SettingsSlice> = (
  set,
  get,
) => {
  let settingsRequestVersion = 0;

  return {
    settings: {
      value: null,
      hydrate: async () => {
        const requestVersion = ++settingsRequestVersion;
        const value = await window.electron.settings.get();
        if (requestVersion !== settingsRequestVersion) {
          return;
        }

        set((state) => {
          state.settings.value = value;
        });
      },
      update: async (input: Partial<AppSettings>) => {
        const requestVersion = ++settingsRequestVersion;
        const value = await window.electron.settings.update(input);
        if (requestVersion !== settingsRequestVersion) {
          return;
        }

        set((state) => {
          state.settings.value = value;
        });
        await syncSelectedCaptureProfileFromSettingsUpdate(
          input,
          value,
          set,
          get,
          () => requestVersion === settingsRequestVersion,
        );
        if (requestVersion !== settingsRequestVersion) {
          return;
        }

        if (shouldTrackSettingsUpdate(input)) {
          trackEvent("settings-updated");
        }
      },
    },
  };
};

async function syncSelectedCaptureProfileFromSettingsUpdate(
  input: Partial<AppSettings>,
  settings: AppSettings,
  set: Parameters<BoundStoreStateCreator<SettingsSlice>>[0],
  get: () => BoundStore,
  isCurrentRequest: () => boolean,
): Promise<void> {
  if (get().captureProfiles?.isProfileUnlocked !== true) {
    return;
  }

  const selectedCaptureProfileId = settings.selectedCaptureProfileId;
  if (!selectedCaptureProfileId) {
    return;
  }

  const captureProfileUpdate = pickCaptureProfileSettingsUpdate(input);
  if (!captureProfileUpdate) {
    return;
  }

  try {
    const updatedProfile = await window.electron.captureProfiles.update({
      id: selectedCaptureProfileId,
      ...captureProfileUpdate,
    });
    if (!isCurrentRequest()) {
      return;
    }

    set((state) => {
      const index = state.captureProfiles.items.findIndex(
        (profile) => profile.id === updatedProfile.id,
      );
      if (index >= 0) {
        state.captureProfiles.items[index] = updatedProfile;
      }
      state.captureProfiles.error = null;
      state.captureProfiles.selectedProfileId = updatedProfile.id;
    });
  } catch (error) {
    if (!isCurrentRequest()) {
      return;
    }

    set((state) => {
      state.captureProfiles.error =
        error instanceof Error
          ? error.message
          : "Unable to update selected capture profile";
    });
  }
}

export { shouldTrackSettingsUpdate };
