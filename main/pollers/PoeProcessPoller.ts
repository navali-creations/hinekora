import { desktopCapturer } from "electron";

import { detectPathOfExileWindowTitle } from "~/main/utils/path-of-exile-window-title";

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

function getFirstGame(candidates: Iterable<GameId>): GameId | null {
  return new Set(candidates).values().next().value ?? null;
}

function findPreferredGame(
  candidates: Iterable<GameId>,
  preferredGames: readonly GameId[],
): GameId | null {
  const candidateSet = new Set(candidates);
  for (const preferredGame of preferredGames) {
    if (candidateSet.has(preferredGame)) {
      return preferredGame;
    }
  }

  return null;
}

function createPreferredGames(
  lastKnownGame: GameId | null,
  fallbackGame: GameId | null,
): GameId[] {
  return [fallbackGame, lastKnownGame].filter(
    (game, index, games): game is GameId =>
      game !== null && games.indexOf(game) === index,
  );
}

async function detectPoeProcessState(
  lastKnownGame: GameId | null = null,
  fallbackGame: GameId | null = null,
): Promise<ProcessState> {
  const processNames = await findRunningProcesses(POE_PROCESS_NAMES);
  if (processNames.length === 0) {
    return {
      isRunning: false,
      processName: "",
    };
  }

  const preferredGames = createPreferredGames(lastKnownGame, fallbackGame);
  const processGames = processNames.flatMap((processName): GameId[] => {
    const game = resolvePoeProcessGame(processName);

    return game ? [game] : [];
  });
  const ambiguousProcessNames = processNames.filter(isAmbiguousPoeProcessName);
  const preferredProcessGame = findPreferredGame(processGames, preferredGames);
  if (preferredProcessGame) {
    return createPoeProcessStateForGame(preferredProcessGame);
  }
  if (preferredGames.length === 0 || ambiguousProcessNames.length === 0) {
    const firstProcessGame = getFirstGame(processGames);
    if (firstProcessGame) {
      return createPoeProcessStateForGame(firstProcessGame);
    }
  }

  const windowGames = await detectRunningPoeWindowGames();
  const preferredWindowGame = findPreferredGame(windowGames, preferredGames);
  if (preferredWindowGame) {
    return createPoeProcessStateForGame(preferredWindowGame);
  }

  const processWindowGames = await detectPoeProcessWindowGames(
    ambiguousProcessNames,
  );
  const preferredProcessWindowGame = findPreferredGame(
    processWindowGames,
    preferredGames,
  );
  if (preferredProcessWindowGame) {
    return createPoeProcessStateForGame(preferredProcessWindowGame);
  }

  const firstWindowGame =
    getFirstGame(windowGames) ?? getFirstGame(processWindowGames);
  if (firstWindowGame) {
    return createPoeProcessStateForGame(firstWindowGame);
  }

  if (ambiguousProcessNames.length > 0 && preferredGames[0]) {
    return createPoeProcessStateForGame(preferredGames[0]);
  }

  return {
    isRunning: true,
    processName: processNames[0] as string,
  };
}

async function detectRunningPoeWindowGames(): Promise<GameId[]> {
  const games: GameId[] = [];
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });

    for (const source of sources) {
      const game = detectPathOfExileWindowTitle(source.name);
      if (game && !games.includes(game)) {
        games.push(game);
      }
    }
  } catch {
    return [];
  }

  return games;
}

async function detectRunningPoeWindowGame(): Promise<GameId | null> {
  return (await detectRunningPoeWindowGames())[0] ?? null;
}

async function detectPoeProcessWindowGames(
  processNames: readonly string[],
): Promise<GameId[]> {
  const games: GameId[] = [];
  for (const processName of processNames) {
    const game = await detectPoeProcessWindowGame(processName);
    if (game && !games.includes(game)) {
      games.push(game);
    }
  }

  return games;
}

async function detectPoeProcessWindowGame(
  processName: string,
): Promise<GameId | null> {
  if (!isAmbiguousPoeProcessName(processName)) {
    return null;
  }

  const processWindows = await listWindowsProcessWindowTitles(processName);
  for (const processWindow of processWindows) {
    const game = detectPathOfExileWindowTitle(processWindow.windowTitle);
    if (game) {
      return game;
    }
  }

  return null;
}

class PoeProcessPoller extends ProcessPoller {
  private lastKnownGame: GameId | null = null;

  constructor(private readonly resolveFallbackGame?: () => GameId | null) {
    super(POE_PROCESS_NAMES, POE_PROCESS_POLL_INTERVAL_MS, {
      inactivePollsBeforeStop: 3,
    });
  }

  protected override pollOnce(): Promise<ProcessState> {
    return detectPoeProcessState(
      this.lastKnownGame,
      this.resolveFallbackGame?.() ?? null,
    ).then((rawState) => {
      const state = this.stabilizeProcessState(rawState);
      const game = resolvePoeProcessGame(state.processName);
      if (state.isRunning && game) {
        this.lastKnownGame = game;
      }

      return state;
    });
  }

  protected override onStop(): void {
    this.lastKnownGame = null;
  }
}

export {
  detectPoeProcessState,
  detectPoeProcessWindowGame,
  detectRunningPoeWindowGame,
  isAmbiguousPoeProcessName,
  isPoeProcessStateForGame,
  POE_PROCESS_NAMES,
  POE_PROCESS_POLL_INTERVAL_MS,
  PoeProcessPoller,
  resolvePoeProcessGame,
};
