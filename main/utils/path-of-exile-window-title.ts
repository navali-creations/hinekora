import type { GameId } from "~/types";

function detectPathOfExileWindowTitle(value: string): GameId | null {
  for (const candidate of createPathOfExileWindowTitleCandidates(value)) {
    const game = detectExactPathOfExileWindowTitle(candidate);
    if (game) {
      return game;
    }
  }

  return null;
}

function detectExactPathOfExileWindowTitle(value: string): GameId | null {
  const normalized = normalizeWindowTitle(value);
  if (normalized === "path of exile 2") {
    return "poe2";
  }

  if (normalized === "path of exile" || normalized === "path of exile 1") {
    return "poe1";
  }

  return null;
}

function createPathOfExileWindowTitleCandidates(value: string): string[] {
  const normalized = normalizeWindowTitle(value);
  const bracketTitle = /^\[[^\]]+\]:\s*(.+)$/.exec(normalized)?.[1] ?? "";
  const candidates = [
    normalized,
    normalized.split(":")[0]!.trim(),
    bracketTitle,
    bracketTitle.split(":")[0]!.trim(),
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function normalizeWindowTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export { detectPathOfExileWindowTitle };
