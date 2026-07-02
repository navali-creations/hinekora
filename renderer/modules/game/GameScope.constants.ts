import type { GameId } from "~/types";

export const gameOptions: Array<{ id: GameId; label: string }> = [
  { id: "poe1", label: "Path of Exile 1" },
  { id: "poe2", label: "Path of Exile 2" },
];

export function getGameLabel(game: GameId): string {
  return gameOptions.find((option) => option.id === game)?.label ?? game;
}

export const leagueOptions: Record<GameId, string[]> = {
  poe1: ["Standard", "Mirage"],
  poe2: ["Standard", "Runes of Aldur"],
};

export type LeagueSettingKey = "poe1SelectedLeague" | "poe2SelectedLeague";

export function getFallbackLeague(game: GameId): string {
  return leagueOptions[game][0] ?? "Standard";
}

export function getLeagueSettingKey(game: GameId): LeagueSettingKey {
  return game === "poe1" ? "poe1SelectedLeague" : "poe2SelectedLeague";
}

export function normalizeLeagueForGame(
  game: GameId,
  league: string | null | undefined,
): string {
  return league && leagueOptions[game].includes(league)
    ? league
    : getFallbackLeague(game);
}
