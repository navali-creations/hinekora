import { desktopCapturer } from "electron";

import { detectPathOfExileWindowTitle } from "~/main/modules/capture-preview/CapturePreview.sources";

import type { GameId } from "~/types";
import {
  findRunningProcess,
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
  poe1: "PathOfExileSteam.exe",
  poe2: "PathOfExile2Steam.exe",
};
const AMBIGUOUS_POE_PROCESS_NAMES = new Set([
  "pathofexilesteam.exe",
  "pathofexile.exe",
]);

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

async function detectPoeProcessState(
  lastKnownGame: GameId | null = null,
  fallbackGame: GameId | null = null,
): Promise<ProcessState> {
  const processName = await findRunningProcess(POE_PROCESS_NAMES);
  if (processName === null) {
    return {
      isRunning: false,
      processName: "",
    };
  }

  const windowGame = await detectRunningPoeWindowGame();
  const processWindowGame =
    windowGame ?? (await detectPoeProcessWindowGame(processName));
  const processGame =
    processWindowGame ??
    (isAmbiguousPoeProcessName(processName)
      ? (lastKnownGame ?? fallbackGame)
      : null);

  return {
    isRunning: true,
    processName:
      processGame === null
        ? processName
        : POE_PROCESS_NAME_BY_WINDOW_GAME[processGame],
  };
}

async function detectRunningPoeWindowGame(): Promise<GameId | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });

    for (const source of sources) {
      const game = detectPathOfExileWindowTitle(source.name);
      if (game) {
        return game;
      }
    }
  } catch {
    return null;
  }

  return null;
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
