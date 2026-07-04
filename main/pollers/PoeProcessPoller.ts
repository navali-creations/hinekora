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
] as const;

const POE_PROCESS_POLL_INTERVAL_MS = 5_000;
const POE_INACTIVE_POLLS_BEFORE_STOP = 2;

function isPoeProcessStateForGame(state: ProcessState, game: GameId): boolean {
  if (!state.isRunning) {
    return false;
  }

  return (
    (state.game ?? resolvePathOfExileProcessGame(state.processName)) === game
  );
}

interface RunningPoeProcessGame {
  game: GameId;
  processName: string;
}

async function resolveRunningPoeProcessGames(
  processNames: readonly string[],
): Promise<RunningPoeProcessGame[]> {
  const runningGames: RunningPoeProcessGame[] = [];

  for (const processName of processNames) {
    const game = resolvePathOfExileProcessGame(processName);
    if (game) {
      runningGames.push({ game, processName });
      continue;
    }

    for (const ambiguousGame of await resolveAmbiguousPoeProcessGames(
      processName,
    )) {
      runningGames.push({ game: ambiguousGame, processName });
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
  if (preferredGame) {
    const preferredRunningGame = runningGames.find(
      ({ game }) => game === preferredGame,
    );
    if (preferredRunningGame) {
      return {
        game: preferredRunningGame.game,
        isRunning: true,
        processName: preferredRunningGame.processName,
      };
    }
  }

  const firstRunningGame = runningGames[0];
  if (firstRunningGame) {
    return {
      game: firstRunningGame.game,
      isRunning: true,
      processName: firstRunningGame.processName,
    };
  }

  return {
    isRunning: true,
    processName: processNames[0] as string,
  };
}

class PoeProcessPoller extends ProcessPoller {
  constructor(private readonly resolveFallbackGame?: () => GameId | null) {
    super(POE_PROCESS_NAMES, POE_PROCESS_POLL_INTERVAL_MS, {
      inactivePollsBeforeStop: POE_INACTIVE_POLLS_BEFORE_STOP,
    });
  }

  protected override pollOnce(): Promise<ProcessState> {
    return detectPoeProcessState(this.resolveFallbackGame?.() ?? null).then(
      (rawState) => this.stabilizeProcessState(rawState),
    );
  }
}

export { detectPoeProcessState, isPoeProcessStateForGame, PoeProcessPoller };
