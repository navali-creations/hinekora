import type { PoeProcessState } from "~/main/modules/poe-process/PoeProcess.dto";

import type { GameId } from "~/types";

function resolvePoeProcessGame(processName: string): GameId | null {
  const normalized = processName.toLowerCase();
  if (!normalized.includes("pathofexile")) {
    return null;
  }

  if (normalized === "pathofexilesteam.exe") {
    return null;
  }

  return normalized.includes("pathofexile2") ? "poe2" : "poe1";
}

function isPoeProcessStateForGame(
  state: PoeProcessState | null,
  game: GameId,
): boolean {
  return (
    state?.isRunning === true &&
    resolvePoeProcessGame(state.processName) === game
  );
}

export { isPoeProcessStateForGame, resolvePoeProcessGame };
