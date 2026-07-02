import type { GameId, Profile } from "~/types";

const profileGameOrder: Record<GameId, number> = {
  poe1: 0,
  poe2: 1,
};

function getProfilesForGame(profiles: Profile[], game: GameId): Profile[] {
  return profiles.filter((profile) => profile.game === game);
}

function sortProfilesForDisplay(profiles: Profile[]): Profile[] {
  return [...profiles].sort((left, right) => {
    const gameComparison =
      profileGameOrder[left.game] - profileGameOrder[right.game];
    if (gameComparison !== 0) {
      return gameComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function resolveActiveGameProfile(
  profiles: Profile[],
  selectedProfileId: string | null,
  activeGame: GameId,
): Profile | null {
  const activeGameProfiles = getProfilesForGame(profiles, activeGame);

  return (
    (selectedProfileId
      ? activeGameProfiles.find((profile) => profile.id === selectedProfileId)
      : null) ??
    activeGameProfiles[0] ??
    null
  );
}

export { getProfilesForGame, resolveActiveGameProfile, sortProfilesForDisplay };
