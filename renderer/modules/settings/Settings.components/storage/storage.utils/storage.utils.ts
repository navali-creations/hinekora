import type { GameId } from "~/types";

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

function formatPercentage(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) {
    return "0%";
  }

  const percentage = fraction * 100;
  if (percentage < 0.01) {
    return "< 0.01%";
  }

  return `${percentage.toFixed(percentage < 1 ? 2 : 1)}%`;
}

function gameLabel(game: GameId): string {
  return game === "poe1" ? "Path of Exile 1" : "Path of Exile 2";
}

export { formatBytes, formatPercentage, gameLabel };
