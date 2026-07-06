import {
  createStoppedPoeProcessStates,
  type PoeProcessStatesByGame,
} from "~/main/modules/poe-process/PoeProcess.dto";

import type { GameId } from "~/types";

interface PoeProcessWatcherPayload {
  type?: unknown;
  states?: unknown;
  message?: unknown;
}

const HELPER_STDOUT_LINE_MAX_CHARS = 16_384;
const HELPER_WINDOW_TITLE_MAX_CHARS = 260;

function normalizeHelperProcessStates(value: unknown): PoeProcessStatesByGame {
  if (!Array.isArray(value)) {
    throw new Error("PoE process watcher helper emitted invalid state payload");
  }

  const seenGames = new Set<GameId>();
  const states = createStoppedPoeProcessStates();
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      throw new Error("PoE process watcher helper emitted invalid state entry");
    }

    const game = Reflect.get(item, "game");
    if (!isHelperGameId(game)) {
      throw new Error("PoE process watcher helper emitted invalid game id");
    }
    if (seenGames.has(game)) {
      throw new Error(
        "PoE process watcher helper emitted duplicate game state",
      );
    }
    seenGames.add(game);

    const isRunning = Reflect.get(item, "isRunning");
    if (typeof isRunning !== "boolean") {
      throw new Error(
        "PoE process watcher helper emitted invalid running state",
      );
    }

    const processName = normalizeHelperProcessName(
      Reflect.get(item, "processName"),
      isRunning,
    );
    const pid = normalizeHelperPid(Reflect.get(item, "pid"));
    if (Reflect.has(item, "pid") && pid === undefined) {
      throw new Error("PoE process watcher helper emitted invalid process id");
    }

    const windowTitle = normalizeHelperWindowTitle(
      Reflect.get(item, "windowTitle"),
      isRunning,
    );

    if (!isRunning) {
      states[game] = {
        game,
        isRunning: false,
        processName: "",
      };
      continue;
    }
    if (pid === undefined) {
      throw new Error("PoE process watcher helper emitted missing process id");
    }

    states[game] = {
      game,
      isRunning: true,
      pid,
      processName,
      windowTitle,
    };
  }

  if (seenGames.size !== 2) {
    throw new Error(
      "PoE process watcher helper emitted incomplete state payload",
    );
  }

  return states;
}

function isHelperGameId(value: unknown): value is GameId {
  return value === "poe1" || value === "poe2";
}

function normalizeHelperProcessName(
  value: unknown,
  isRunning: boolean,
): string {
  if (typeof value !== "string" || value.length > 260) {
    throw new Error("PoE process watcher helper emitted invalid process name");
  }

  if (isRunning && value.trim().length === 0) {
    throw new Error("PoE process watcher helper emitted invalid process name");
  }

  return isRunning ? value : "";
}

function normalizeHelperPid(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 0xffffffff
    ? value
    : undefined;
}

function normalizeHelperWindowTitle(
  value: unknown,
  isRunning: boolean,
): string {
  if (!isRunning) {
    if (value !== undefined && typeof value !== "string") {
      throw new Error(
        "PoE process watcher helper emitted invalid window title",
      );
    }

    return "";
  }

  if (
    typeof value !== "string" ||
    value.length > HELPER_WINDOW_TITLE_MAX_CHARS
  ) {
    throw new Error("PoE process watcher helper emitted invalid window title");
  }

  if (isRunning && value.trim().length === 0) {
    throw new Error("PoE process watcher helper emitted invalid window title");
  }

  return value;
}

function createHelperExitMessage(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
): string {
  const baseMessage = `PoE process watcher helper exited with code ${
    code ?? "null"
  } and signal ${signal ?? "null"}`;
  if (stderr.length === 0) {
    return baseMessage;
  }

  return `${baseMessage}; stderr: ${stderr.replace(/\s+/g, " ").slice(0, 512)}`;
}

export type { PoeProcessWatcherPayload };
export {
  createHelperExitMessage,
  HELPER_STDOUT_LINE_MAX_CHARS,
  HELPER_WINDOW_TITLE_MAX_CHARS,
  normalizeHelperProcessStates,
};
