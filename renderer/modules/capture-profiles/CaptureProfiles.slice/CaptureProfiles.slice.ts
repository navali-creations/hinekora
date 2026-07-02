import {
  createCaptureTargetFromPreviewSource,
  resolveCapturePreviewSourceId,
} from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import {
  createSettingsUpdateFromCaptureProfile,
  pickCaptureProfileSettingsUpdate,
  resolveActiveGameCaptureProfile,
  resolveCaptureProfileForGame,
  resolveSelectedCaptureProfile,
} from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import {
  getLeagueSettingKey,
  normalizeLeagueForGame,
} from "~/renderer/modules/game/GameScope.constants";
import { trackEvent } from "~/renderer/modules/umami";
import type {
  BoundStore,
  BoundStoreStateCreator,
  CaptureProfilesSlice,
} from "~/renderer/store/store.types";

import type {
  AppSettings,
  CaptureProfile,
  CaptureProfileUpdateInput,
  CaptureTarget,
  GameId,
} from "~/types";

const captureProfileMemoryGames: GameId[] = ["poe1", "poe2"];

export const createCaptureProfilesSlice: BoundStoreStateCreator<
  CaptureProfilesSlice
> = (set, get) => {
  const applySelectedProfileSettings = createSelectedProfileSettingsApplier(
    set,
    get,
    () => selectedProfileIdsByGame,
  );
  const selectedProfileIdsByGame: Partial<Record<GameId, string>> = {};

  const rememberProfileSelection = (profile: CaptureProfile) => {
    selectedProfileIdsByGame[profile.game] = profile.id;
  };

  const pruneRememberedProfiles = (items: CaptureProfile[]) => {
    for (const game of Object.keys(selectedProfileIdsByGame) as GameId[]) {
      const selectedProfileId = selectedProfileIdsByGame[game];
      if (
        selectedProfileId &&
        !items.some(
          (item) => item.id === selectedProfileId && item.game === game,
        )
      ) {
        delete selectedProfileIdsByGame[game];
      }
    }
  };

  const seedRememberedProfiles = (
    settings: AppSettings | null | undefined,
    items: CaptureProfile[],
  ) => {
    const persistedSelections = settings?.selectedCaptureProfileIdsByGame ?? {};
    for (const game of Object.keys(persistedSelections) as GameId[]) {
      const selectedProfileId = persistedSelections[game];
      if (
        selectedProfileId &&
        items.some(
          (item) => item.id === selectedProfileId && item.game === game,
        )
      ) {
        selectedProfileIdsByGame[game] = selectedProfileId;
      }
    }
  };

  return {
    captureProfiles: {
      items: [],
      isLoading: false,
      error: null,
      selectedProfileId: null,
      isProfileUnlocked: false,
      hydrate: async () => {
        set((state) => {
          state.captureProfiles.isLoading = true;
          state.captureProfiles.error = null;
        });
        try {
          const items = await window.electron.captureProfiles.list();
          const settingsValue = get().settings.value;
          const activeGame = settingsValue?.activeGame ?? "poe1";
          seedRememberedProfiles(settingsValue, items);
          const selectedProfile =
            resolveCaptureProfileForGame(
              items,
              selectedProfileIdsByGame[activeGame] ??
                settingsValue?.selectedCaptureProfileId ??
                null,
              activeGame,
            ) ??
            resolveActiveGameCaptureProfile(
              items,
              settingsValue?.selectedCaptureProfileId ?? null,
              activeGame,
            );
          set((state) => {
            state.captureProfiles.items = items;
            state.captureProfiles.isLoading = false;
            state.captureProfiles.selectedProfileId =
              selectedProfile?.id ?? null;
          });
          if (selectedProfile) {
            rememberProfileSelection(selectedProfile);
            void applySelectedProfileSettings(selectedProfile);
          }
        } catch (error) {
          set((state) => {
            state.captureProfiles.isLoading = false;
            state.captureProfiles.error =
              error instanceof Error ? error.message : "Load failed";
          });
        }
      },
      create: async (name: string) => {
        const activeGame = get().settings.value?.activeGame ?? "poe1";
        const created = await window.electron.captureProfiles.create({
          name,
          game: activeGame,
        });
        const items = await window.electron.captureProfiles.list();
        set((state) => {
          state.captureProfiles.items = items;
          state.captureProfiles.selectedProfileId = created.id;
          state.captureProfiles.error = null;
        });
        rememberProfileSelection(created);
        void applySelectedProfileSettings(created);
        trackEvent("capture-profile-created", {
          game: created.game,
        });
      },
      update: async (input: CaptureProfileUpdateInput) => {
        const updated = await window.electron.captureProfiles.update(input);
        const items = await window.electron.captureProfiles.list();
        const wasSelected =
          get().captureProfiles.selectedProfileId === updated.id;
        set((state) => {
          state.captureProfiles.items = items;
          state.captureProfiles.error = null;
          if (wasSelected) {
            state.captureProfiles.selectedProfileId = updated.id;
          }
        });
        if (wasSelected) {
          rememberProfileSelection(updated);
          void applySelectedProfileSettings(updated);
        }
        trackEvent("capture-profile-updated");
      },
      delete: async (id: string) => {
        await window.electron.captureProfiles.delete(id);
        const items = await window.electron.captureProfiles.list();
        pruneRememberedProfiles(items);
        const settingsValue = get().settings.value;
        const selectedProfile = resolveActiveGameCaptureProfile(
          items,
          get().captureProfiles.selectedProfileId === id
            ? null
            : get().captureProfiles.selectedProfileId,
          settingsValue?.activeGame ?? "poe1",
        );
        set((state) => {
          state.captureProfiles.items = items;
          state.captureProfiles.selectedProfileId = selectedProfile?.id ?? null;
          state.captureProfiles.error = null;
        });
        if (selectedProfile) {
          rememberProfileSelection(selectedProfile);
          void applySelectedProfileSettings(selectedProfile);
        }
        trackEvent("capture-profile-deleted");
      },
      select: (id: string) => {
        const profile =
          get().captureProfiles.items.find((item) => item.id === id) ?? null;
        if (!profile) {
          set((state) => {
            state.captureProfiles.error = "Capture profile not found";
          });
          return;
        }

        set((state) => {
          state.captureProfiles.error = null;
          state.captureProfiles.selectedProfileId = id;
        });
        rememberProfileSelection(profile);
        void applySelectedProfileSettings(profile);
        trackEvent("capture-profile-selected");
      },
      selectWithPreviewSource: (id: string) => {
        const profile =
          get().captureProfiles.items.find((item) => item.id === id) ?? null;
        if (!profile) {
          set((state) => {
            state.captureProfiles.error = "Capture profile not found";
          });
          return;
        }

        set((state) => {
          state.captureProfiles.error = null;
          state.captureProfiles.selectedProfileId = id;
        });
        selectCapturePreviewSourceForGame(
          set,
          get,
          profile.captureTarget,
          profile.game,
        );
        rememberProfileSelection(profile);
        void applySelectedProfileSettings(profile);
        trackEvent("capture-profile-selected");
      },
      selectForGame: async (game: GameId) => {
        const items = get().captureProfiles.items;
        const selectedProfile = resolveCaptureProfileForGame(
          items,
          selectedProfileIdsByGame[game] ??
            get().settings.value?.selectedCaptureProfileIdsByGame[game] ??
            get().captureProfiles.selectedProfileId,
          game,
        );
        set((state) => {
          state.captureProfiles.error = null;
          state.captureProfiles.selectedProfileId = selectedProfile?.id ?? null;
        });
        selectCapturePreviewSourceForGame(
          set,
          get,
          selectedProfile?.captureTarget ?? null,
          game,
        );

        if (selectedProfile) {
          rememberProfileSelection(selectedProfile);
          await applySelectedProfileSettings(selectedProfile);
        } else {
          await applyGameSettings(set, get, game);
        }
        trackEvent("capture-profile-game-selected", { game });
      },
      setProfileUnlocked: (isUnlocked: boolean) => {
        if (isUnlocked && isCaptureProfileUnlockBlocked(get)) {
          return;
        }

        set((state) => {
          state.captureProfiles.isProfileUnlocked = isUnlocked;
          state.captureProfiles.error = null;
        });
        if (isUnlocked) {
          void persistCurrentSettingsToSelectedCaptureProfile(set, get);
        }
      },
      toggleProfileLock: () => {
        get().captureProfiles.setProfileUnlocked(
          !get().captureProfiles.isProfileUnlocked,
        );
      },
      startListening: () =>
        window.electron.captureProfiles.onChanged((items) => {
          pruneRememberedProfiles(items);
          const settingsValue = get().settings.value;
          const currentSelectedProfile = resolveSelectedCaptureProfile(
            items,
            get().captureProfiles.selectedProfileId,
          );
          const selectedProfile =
            currentSelectedProfile ??
            resolveActiveGameCaptureProfile(
              items,
              get().captureProfiles.selectedProfileId,
              settingsValue?.activeGame ?? "poe1",
            );
          set((state) => {
            state.captureProfiles.items = items;
            state.captureProfiles.selectedProfileId =
              selectedProfile?.id ?? null;
          });
          if (selectedProfile) {
            rememberProfileSelection(selectedProfile);
            void applySelectedProfileSettings(selectedProfile);
          }
        }),
    },
  };
};

function isCaptureProfileUnlockBlocked(get: () => BoundStore): boolean {
  const status = get().managedRecorder?.status;

  return (
    status?.bufferActive === true ||
    status?.runRecordingActive === true ||
    status?.isStartingRecording === true ||
    status?.isStoppingRecording === true
  );
}

async function persistCurrentSettingsToSelectedCaptureProfile(
  set: Parameters<BoundStoreStateCreator<CaptureProfilesSlice>>[0],
  get: () => BoundStore,
): Promise<void> {
  const selectedProfileId = get().captureProfiles.selectedProfileId;
  const settings = get().settings.value;
  const selectedProfile =
    get().captureProfiles.items.find(
      (profile) => profile.id === selectedProfileId,
    ) ?? null;
  if (!selectedProfileId || !settings) {
    return;
  }

  const captureProfileUpdate = pickCaptureProfileSettingsUpdate(settings);
  if (!captureProfileUpdate || !selectedProfile) {
    return;
  }
  const selectedSource =
    get().capturePreview.sources.find(
      (source) => source.id === get().capturePreview.selectedSourceId,
    ) ?? null;
  const captureTarget =
    selectedSource &&
    (!selectedSource.game || selectedSource.game === selectedProfile.game)
      ? createCaptureTargetFromPreviewSource(selectedSource)
      : undefined;

  try {
    const updatedProfile = await window.electron.captureProfiles.update({
      id: selectedProfileId,
      ...captureProfileUpdate,
      ...(captureTarget ? { captureTarget } : {}),
    });
    if (
      get().captureProfiles.selectedProfileId !== selectedProfileId ||
      get().captureProfiles.isProfileUnlocked !== true
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
      state.captureProfiles.selectedProfileId = updatedProfile.id;
      state.captureProfiles.error = null;
    });
  } catch (error) {
    set((state) => {
      state.captureProfiles.error =
        error instanceof Error
          ? error.message
          : "Unable to update selected capture profile";
    });
  }
}

function selectCapturePreviewSourceForGame(
  set: Parameters<BoundStoreStateCreator<CaptureProfilesSlice>>[0],
  get: () => BoundStore,
  captureTarget: CaptureTarget | null,
  game: GameId,
): void {
  const capturePreview = get().capturePreview;
  const selectedSourceId = resolveCapturePreviewSourceId(
    captureTarget,
    capturePreview.sources,
    capturePreview.selectedSourceId,
    game,
  );

  set((state) => {
    state.capturePreview.selectedSourceId = selectedSourceId;
  });
}

async function applyGameSettings(
  set: Parameters<BoundStoreStateCreator<CaptureProfilesSlice>>[0],
  get: () => BoundStore,
  game: GameId,
): Promise<void> {
  const settings = get().settings;
  const currentSettings = settings.value;
  const leagueKey = getLeagueSettingKey(game);
  const nextLeague = normalizeLeagueForGame(game, currentSettings?.[leagueKey]);
  const selectedCaptureProfileIdsByGame = currentSettings
    ? createValidSelectedProfileIdsByGame(
        get().captureProfiles.items,
        currentSettings.selectedCaptureProfileIdsByGame,
      )
    : {};
  delete selectedCaptureProfileIdsByGame[game];

  try {
    await settings.update({
      activeGame: game,
      activeLeague: nextLeague,
      [leagueKey]: nextLeague,
      selectedCaptureProfileId: null,
      selectedCaptureProfileIdsByGame,
    });
  } catch (error) {
    set((state) => {
      state.captureProfiles.error =
        error instanceof Error
          ? error.message
          : "Unable to persist selected capture profile";
    });
  }
}

function createSelectedProfileSettingsApplier(
  set: Parameters<BoundStoreStateCreator<CaptureProfilesSlice>>[0],
  get: () => BoundStore,
  getSelectedProfileIdsByGame: () => Partial<Record<GameId, string>>,
): (
  profile: Parameters<typeof createSettingsUpdateFromCaptureProfile>[0],
) => Promise<void> {
  let requestVersion = 0;

  return async (profile) => {
    const settings = get().settings;
    const currentSettings = settings.value;
    const currentSettingsWithProfileMemory = currentSettings
      ? {
          ...currentSettings,
          selectedCaptureProfileIdsByGame: createValidSelectedProfileIdsByGame(
            get().captureProfiles.items,
            currentSettings.selectedCaptureProfileIdsByGame,
            getSelectedProfileIdsByGame(),
            { [profile.game]: profile.id },
          ),
        }
      : currentSettings;
    const settingsUpdate = createSettingsUpdateFromCaptureProfile(
      profile,
      currentSettingsWithProfileMemory,
    );
    if (
      currentSettings &&
      !shouldApplyCaptureProfileSettings(currentSettings, settingsUpdate)
    ) {
      return;
    }

    requestVersion += 1;
    const currentRequestVersion = requestVersion;
    try {
      await settings.update(settingsUpdate);
    } catch (error) {
      if (requestVersion !== currentRequestVersion) {
        return;
      }

      set((state) => {
        state.captureProfiles.error =
          error instanceof Error
            ? error.message
            : "Unable to persist selected capture profile";
      });
    }
  };
}

function createValidSelectedProfileIdsByGame(
  profiles: CaptureProfile[],
  ...memories: Array<Partial<Record<GameId, string | null | undefined>>>
): AppSettings["selectedCaptureProfileIdsByGame"] {
  const selectedProfileIds: Partial<Record<GameId, string | null | undefined>> =
    {};
  for (const memory of memories) {
    Object.assign(selectedProfileIds, memory);
  }

  const validProfileIdsByGame: AppSettings["selectedCaptureProfileIdsByGame"] =
    {};
  for (const game of captureProfileMemoryGames) {
    const selectedProfileId = selectedProfileIds[game];
    if (
      selectedProfileId &&
      profiles.some(
        (profile) => profile.id === selectedProfileId && profile.game === game,
      )
    ) {
      validProfileIdsByGame[game] = selectedProfileId;
    }
  }

  return validProfileIdsByGame;
}

function shouldApplyCaptureProfileSettings(
  currentSettings: AppSettings,
  settingsUpdate: Partial<AppSettings>,
): boolean {
  return (Object.keys(settingsUpdate) as Array<keyof AppSettings>).some(
    (key) =>
      !isCaptureProfileSettingValueEqual(
        key,
        currentSettings[key],
        settingsUpdate[key],
      ),
  );
}

function isCaptureProfileSettingValueEqual(
  key: keyof AppSettings,
  currentValue: AppSettings[keyof AppSettings],
  nextValue: AppSettings[keyof AppSettings] | undefined,
): boolean {
  if (key !== "selectedCaptureProfileIdsByGame") {
    return currentValue === nextValue;
  }

  const currentMemory =
    currentValue as AppSettings["selectedCaptureProfileIdsByGame"];
  const nextMemory = nextValue as
    | AppSettings["selectedCaptureProfileIdsByGame"]
    | undefined;

  return (
    currentMemory.poe1 === nextMemory?.poe1 &&
    currentMemory.poe2 === nextMemory?.poe2
  );
}
