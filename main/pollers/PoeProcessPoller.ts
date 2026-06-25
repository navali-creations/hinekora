import { detectPathOfExileWindowTitle } from "~/main/utils/path-of-exile-window-title";
import { resolvePathOfExileProcessGame } from "~/types/path-of-exile-process";

import type { GameId } from "~/types";
import {
  findRunningProcesses,
  listWindowsProcessWindowTitles,
} from "./isProcessRunning";
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

function isPoeProcessStateForGame(state: ProcessState, game: GameId): boolean {
  return (
    state.isRunning && resolvePathOfExileProcessGame(state.processName) === game
  );
}

function createPoeProcessStateForGame(game: GameId): ProcessState {
  return {
    isRunning: true,
    processName: POE_PROCESS_NAME_BY_WINDOW_GAME[game],
  };
}

interface RunningPoeProcessGame {
  game: GameId;
}

async function resolveRunningPoeProcessGames(
  processNames: readonly string[],
): Promise<RunningPoeProcessGame[]> {
  const runningGames: RunningPoeProcessGame[] = [];

  for (const processName of processNames) {
    const game = resolvePathOfExileProcessGame(processName);
    if (game) {
      runningGames.push({ game });
      continue;
    }

    for (const ambiguousGame of await resolveAmbiguousPoeProcessGames(
      processName,
    )) {
      runningGames.push({ game: ambiguousGame });
    }
  }

  return runningGames;
}

async function resolveAmbiguousPoeProcessGames(
  processName: string,
): Promise<GameId[]> {
  const games = new Set<GameId>();
  const windowTitles = await listWindowsProcessWindowTitles(processName);

  for (const { windowTitle } of windowTitles) {
    const game = detectPathOfExileWindowTitle(windowTitle);
    if (game) {
      games.add(game);
    }
  }

  return [...games];
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

  const runningGames = await resolveRunningPoeProcessGames(processNames);
  const preferredGame = activeGame ?? fallbackGame;
  if (
    preferredGame &&
    runningGames.some(({ game }) => game === preferredGame)
  ) {
    return createPoeProcessStateForGame(preferredGame);
  }

  const firstRunningGame = runningGames[0];
  if (firstRunningGame) {
    return createPoeProcessStateForGame(firstRunningGame.game);
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

export { detectPoeProcessState, isPoeProcessStateForGame, PoeProcessPoller };
