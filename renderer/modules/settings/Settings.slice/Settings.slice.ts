import type { SettingsStoreScopedSnapshot } from "~/main/modules/settings-store/SettingsStore.dto";
import { pickCaptureProfileSettingsUpdate } from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { isManagedRecorderStatusActive } from "~/renderer/modules/managed-recorder/ManagedRecorder.utils/ManagedRecorder.utils";
import { trackEvent } from "~/renderer/modules/umami";
import type {
  BoundStore,
  BoundStoreStateCreator,
  SettingsSlice,
} from "~/renderer/store/store.types";

import { type AppSettings, captureProfileSettingKeys } from "~/types";

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
  let settingsChangeVersion = 0;

  return {
    settings: {
      value: null,
      hydrate: async () => {
        const requestVersion = ++settingsRequestVersion;
        const changeVersion = settingsChangeVersion;
        const value = await window.electron.settings.get();
        if (
          requestVersion !== settingsRequestVersion ||
          changeVersion !== settingsChangeVersion
        ) {
          return;
        }

        set((state) => {
          state.settings.value = value;
        });
      },
      startListening: () =>
        window.electron.settings.onChanged((value) => {
          const previousValue = get().settings.value;
          const captureSettingsUpdate = createCaptureSettingsUpdateDelta(
            previousValue,
            value,
          );
          settingsChangeVersion += 1;
          const changeVersion = settingsChangeVersion;
          set((state) => {
            state.settings.value = value;
          });
          void syncSelectedCaptureProfileFromSettingsUpdate(
            captureSettingsUpdate,
            value,
            set,
            get,
            () => changeVersion === settingsChangeVersion,
          );
        }),
      update: async (input: Partial<AppSettings>) => {
        const updateSettings = window.electron.settings.update;
        if (!updateSettings) {
          throw new Error("Settings updates are not available in this window");
        }

        const requestVersion = ++settingsRequestVersion;
        const changeVersion = settingsChangeVersion;
        const value = await updateSettings(input);
        if (requestVersion !== settingsRequestVersion) {
          return;
        }

        const wasHandledByChangeEvent = changeVersion !== settingsChangeVersion;
        if (!wasHandledByChangeEvent) {
          set((state) => {
            state.settings.value = value;
          });
          await syncSelectedCaptureProfileFromSettingsUpdate(
            input,
            value,
            set,
            get,
            () =>
              requestVersion === settingsRequestVersion &&
              changeVersion === settingsChangeVersion,
          );
        }
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
  settings: SettingsStoreScopedSnapshot,
  set: Parameters<BoundStoreStateCreator<SettingsSlice>>[0],
  get: () => BoundStore,
  isCurrentRequest: () => boolean,
): Promise<void> {
  if (get().captureProfiles?.isProfileUnlocked !== true) {
    return;
  }

  if (isManagedRecorderStatusActive(get().managedRecorder?.status)) {
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
    if (
      !isCurrentRequest() ||
      isManagedRecorderStatusActive(get().managedRecorder?.status)
    ) {
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
    if (
      !isCurrentRequest() ||
      isManagedRecorderStatusActive(get().managedRecorder?.status)
    ) {
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

function createCaptureSettingsUpdateDelta(
  previous: SettingsStoreScopedSnapshot | null,
  next: SettingsStoreScopedSnapshot,
): Partial<AppSettings> {
  const input: Partial<AppSettings> = {};

  for (const key of captureProfileSettingKeys) {
    if (Object.hasOwn(next, key) && previous?.[key] !== next[key]) {
      input[key] = next[key] as never;
    }
  }

  return input;
}

export { shouldTrackSettingsUpdate };
