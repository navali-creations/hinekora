import { leagueOptions } from "~/renderer/modules/game/GameScope.constants";
import { formatMediaTime } from "~/renderer/modules/media-playback/MediaTimeline.utils/MediaTimeline.utils";

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
  catalogLeagues: readonly string[] = leagueOptions[game],
): MediaLibraryLeagueOption[] {
  const uniqueLeagues = new Set<string>(catalogLeagues);
  if (selectedLeague !== ALL_LEAGUES_VALUE) {
    uniqueLeagues.add(selectedLeague);
  }
  const savedOnlyLeagues = savedLeagues
    .filter((league) => league && !uniqueLeagues.has(league))
    .sort((first, second) => first.localeCompare(second));

  return [
    { value: ALL_LEAGUES_VALUE, label: "All leagues" },
    ...Array.from(uniqueLeagues).map((league) => ({
      value: league,
      label: league,
    })),
    ...savedOnlyLeagues.map((league) => ({ value: league, label: league })),
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

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
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

  return formatMediaTime(value);
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
