import type { GameId } from "./schemas";

const AMBIGUOUS_PATH_OF_EXILE_PROCESS_NAMES = new Set(["pathofexilesteam.exe"]);

function isAmbiguousPathOfExileProcessName(processName: string): boolean {
  return AMBIGUOUS_PATH_OF_EXILE_PROCESS_NAMES.has(processName.toLowerCase());
}

function resolvePathOfExileProcessGame(processName: string): GameId | null {
  const normalized = processName.toLowerCase();
  if (!normalized.includes("pathofexile")) {
    return null;
  }

  if (isAmbiguousPathOfExileProcessName(processName)) {
    return null;
  }

  return normalized.includes("pathofexile2") ? "poe2" : "poe1";
}

export { isAmbiguousPathOfExileProcessName, resolvePathOfExileProcessGame };
