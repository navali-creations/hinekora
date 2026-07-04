import { leagueOptions } from "~/renderer/modules/game/GameScope.constants";

import type { GameId } from "~/types";

const ALL_LEAGUES_VALUE = "__all__";

interface MediaLibraryScope {
  game: GameId;
  league: string;
}

interface MediaLibraryLeagueOption {
  value: string;
  label: string;
}

function buildMediaLibraryLeagueOptions(
  game: GameId,
  savedLeagues: readonly string[],
  selectedLeague: string,
): MediaLibraryLeagueOption[] {
  const uniqueLeagues = new Set<string>([
    ...leagueOptions[game],
    ...savedLeagues.filter(Boolean),
  ]);
  if (selectedLeague !== ALL_LEAGUES_VALUE) {
    uniqueLeagues.add(selectedLeague);
  }

  return [
    { value: ALL_LEAGUES_VALUE, label: "All leagues" },
    ...Array.from(uniqueLeagues)
      .sort((first, second) => first.localeCompare(second))
      .map((league) => ({ value: league, label: league })),
  ];
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "--";
  }

  const totalSeconds = Math.round(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getPathFileName(path: string | null | undefined): string {
  if (!path) {
    return "Pending";
  }

  return path.split(/[\\/]/).at(-1) || path;
}

export type { MediaLibraryLeagueOption, MediaLibraryScope };
export {
  ALL_LEAGUES_VALUE,
  buildMediaLibraryLeagueOptions,
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  getPathFileName,
};
