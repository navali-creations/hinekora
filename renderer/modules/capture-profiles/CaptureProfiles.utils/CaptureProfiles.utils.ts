import {
  getLeagueSettingKey,
  normalizeLeagueForGame,
} from "~/renderer/modules/game/GameScope.constants";

import type {
  AppSettings,
  CaptureProfile,
  CaptureProfileUpdateInput,
  GameId,
} from "~/types";
import { captureProfileSettingKeys } from "~/types";

type CaptureProfileSettingKey = (typeof captureProfileSettingKeys)[number];
type CaptureProfileSettingsUpdate = Partial<
  Pick<CaptureProfileUpdateInput, CaptureProfileSettingKey>
>;

const captureProfileGameOrder: Record<GameId, number> = {
  poe1: 0,
  poe2: 1,
};
function getCaptureProfilesForGame(
  profiles: CaptureProfile[],
  game: GameId,
): CaptureProfile[] {
  return profiles.filter((profile) => profile.game === game);
}

function getCaptureProfileDisplayName(profile: CaptureProfile): string {
  if (isDefaultCaptureProfileForGame(profile, "poe1")) {
    return "Default PoE 1 Profile";
  }

  if (isDefaultCaptureProfileForGame(profile, "poe2")) {
    return "Default PoE 2 Profile";
  }

  return profile.name;
}

function isDefaultCaptureProfile(profile: CaptureProfile): boolean {
  return isDefaultCaptureProfileForGame(profile, profile.game);
}

function isDefaultCaptureProfileForGame(
  profile: CaptureProfile,
  game: GameId,
): boolean {
  return profile.game === game && profile.isDefault === true;
}

function sortCaptureProfilesForDisplay(
  profiles: CaptureProfile[],
): CaptureProfile[] {
  return [...profiles].sort((left, right) => {
    const gameComparison =
      captureProfileGameOrder[left.game] - captureProfileGameOrder[right.game];
    if (gameComparison !== 0) {
      return gameComparison;
    }

    return getCaptureProfileDisplayName(left).localeCompare(
      getCaptureProfileDisplayName(right),
    );
  });
}

function resolveActiveGameCaptureProfile(
  profiles: CaptureProfile[],
  selectedProfileId: string | null,
  activeGame: GameId,
): CaptureProfile | null {
  const selectedProfile = resolveSelectedCaptureProfile(
    profiles,
    selectedProfileId,
  );
  if (selectedProfile?.game === activeGame) {
    return selectedProfile;
  }

  const activeGameProfiles = getCaptureProfilesForGame(profiles, activeGame);

  return activeGameProfiles[0] ?? profiles[0] ?? null;
}

function resolveSelectedCaptureProfile(
  profiles: CaptureProfile[],
  selectedProfileId: string | null,
): CaptureProfile | null {
  return selectedProfileId
    ? (profiles.find((profile) => profile.id === selectedProfileId) ?? null)
    : null;
}

function resolveCaptureProfileForGame(
  profiles: CaptureProfile[],
  selectedProfileId: string | null,
  game: GameId,
): CaptureProfile | null {
  const selectedProfile = selectedProfileId
    ? (profiles.find(
        (profile) => profile.id === selectedProfileId && profile.game === game,
      ) ?? null)
    : null;
  if (selectedProfile) {
    return selectedProfile;
  }

  return getCaptureProfilesForGame(profiles, game)[0] ?? null;
}

function createSettingsUpdateFromCaptureProfile(
  profile: CaptureProfile,
  currentSettings?: AppSettings | null,
): Partial<AppSettings> {
  const leagueKey = getLeagueSettingKey(profile.game);
  const activeLeague = currentSettings
    ? normalizeLeagueForGame(profile.game, currentSettings[leagueKey])
    : undefined;
  const settingsUpdate: Partial<AppSettings> = {
    activeGame: profile.game,
    ...(activeLeague ? { activeLeague } : {}),
    selectedCaptureProfileId: profile.id,
    selectedCaptureProfileIdsByGame: {
      ...(currentSettings?.selectedCaptureProfileIdsByGame ?? {}),
      [profile.game]: profile.id,
    },
  };
  for (const key of captureProfileSettingKeys) {
    settingsUpdate[key] = profile[key] as never;
  }

  return settingsUpdate;
}

function pickCaptureProfileSettingsUpdate(
  input: Partial<AppSettings>,
): CaptureProfileSettingsUpdate | null {
  const update: CaptureProfileSettingsUpdate = {};

  for (const key of captureProfileSettingKeys) {
    if (Object.hasOwn(input, key)) {
      update[key] = input[key] as never;
    }
  }

  return Object.keys(update).length > 0 ? update : null;
}

export type { CaptureProfileSettingKey, CaptureProfileSettingsUpdate };
export {
  captureProfileSettingKeys,
  createSettingsUpdateFromCaptureProfile,
  getCaptureProfileDisplayName,
  getCaptureProfilesForGame,
  isDefaultCaptureProfile,
  pickCaptureProfileSettingsUpdate,
  resolveActiveGameCaptureProfile,
  resolveCaptureProfileForGame,
  resolveSelectedCaptureProfile,
  sortCaptureProfilesForDisplay,
};
