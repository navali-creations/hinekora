import type { GameId } from "~/types";

function detectPathOfExileWindowTitle(value: string): GameId | null {
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalized === "path of exile 2") {
    return "poe2";
  }

  if (normalized === "path of exile" || normalized === "path of exile 1") {
    return "poe1";
  }

  return null;
}

export { detectPathOfExileWindowTitle };
