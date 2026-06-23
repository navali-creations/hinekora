import type { GameId } from "~/types";
import { findRunningProcesses } from "./isProcessRunning";
import { ProcessPoller, type ProcessState } from "./ProcessPoller";

const POE_PROCESS_NAMES = [
  "PathOfExileSteam.exe",
  "PathOfExile.exe",
  "PathOfExile_x64Steam.exe",
  "PathOfExile_x64.exe",
  "PathOfExile2Steam.exe",
  "PathOfExile2.exe",
  "PathOfExile2_x64Steam.exe",
  "PathOfExile2_x64.exe",
] as const;

const POE_PROCESS_POLL_INTERVAL_MS = 5_000;

const POE_PROCESS_NAME_BY_WINDOW_GAME: Record<GameId, string> = {
  poe1: "PathOfExile_x64Steam.exe",
  poe2: "PathOfExile2Steam.exe",
};
const AMBIGUOUS_POE_PROCESS_NAMES = new Set(["pathofexilesteam.exe"]);

function resolvePoeProcessGame(processName: string): GameId | null {
  const normalized = processName.toLowerCase();
  if (!normalized.includes("pathofexile")) {
    return null;
  }

  if (isAmbiguousPoeProcessName(processName)) {
    return null;
  }

  return normalized.includes("pathofexile2") ? "poe2" : "poe1";
}

function isPoeProcessStateForGame(state: ProcessState, game: GameId): boolean {
  return state.isRunning && resolvePoeProcessGame(state.processName) === game;
}

function isAmbiguousPoeProcessName(processName: string): boolean {
  return AMBIGUOUS_POE_PROCESS_NAMES.has(processName.toLowerCase());
}

function createPoeProcessStateForGame(game: GameId): ProcessState {
  return {
    isRunning: true,
    processName: POE_PROCESS_NAME_BY_WINDOW_GAME[game],
  };
}

function isProcessNameCompatibleWithGame(
  processName: string,
  game: GameId,
): boolean {
  const processGame = resolvePoeProcessGame(processName);

  return processGame === game || isAmbiguousPoeProcessName(processName);
}

async function detectPoeProcessState(
  activeGame: GameId | null = null,
  fallbackGame: GameId | null = null,
): Promise<ProcessState> {
  const processNames = await findRunningProcesses(POE_PROCESS_NAMES);
  if (processNames.length === 0) {
    return {
      isRunning: false,
      processName: "",
    };
  }

  const preferredGame = activeGame ?? fallbackGame;
  if (
    preferredGame &&
    processNames.some((processName) =>
      isProcessNameCompatibleWithGame(processName, preferredGame),
    )
  ) {
    return createPoeProcessStateForGame(preferredGame);
  }

  for (const processName of processNames) {
    const game = resolvePoeProcessGame(processName);
    if (game) {
      return createPoeProcessStateForGame(game);
    }
  }

  return {
    isRunning: true,
    processName: processNames[0] as string,
  };
}

class PoeProcessPoller extends ProcessPoller {
  constructor(private readonly resolveFallbackGame?: () => GameId | null) {
    super(POE_PROCESS_NAMES, POE_PROCESS_POLL_INTERVAL_MS, {
      inactivePollsBeforeStop: 3,
    });
  }

  protected override pollOnce(): Promise<ProcessState> {
    return detectPoeProcessState(this.resolveFallbackGame?.() ?? null).then(
      (rawState) => this.stabilizeProcessState(rawState),
    );
  }
}

export {
  detectPoeProcessState,
  isAmbiguousPoeProcessName,
  isPoeProcessStateForGame,
  POE_PROCESS_NAMES,
  POE_PROCESS_POLL_INTERVAL_MS,
  PoeProcessPoller,
  resolvePoeProcessGame,
};
