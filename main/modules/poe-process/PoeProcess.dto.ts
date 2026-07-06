import type { GameId } from "~/types";

const POE_PROCESS_GAMES = ["poe1", "poe2"] as const satisfies readonly GameId[];

interface PoeProcessRunningState {
  game: GameId;
  isRunning: true;
  pid: number;
  processName: string;
  windowTitle: string;
}

interface PoeProcessStoppedState {
  game?: GameId | null;
  isRunning: false;
  pid?: never;
  processName: "";
  windowTitle?: never;
}

type PoeProcessState = PoeProcessRunningState | PoeProcessStoppedState;
type PoeProcessStatesByGame = Record<GameId, PoeProcessState>;

interface PoeProcessSnapshot {
  activeGame: GameId | null;
  activeState: PoeProcessState;
  states: PoeProcessStatesByGame;
}

interface PoeProcessError {
  error: string;
}

function createStoppedPoeProcessState(game?: GameId): PoeProcessStoppedState {
  const state: PoeProcessStoppedState = {
    isRunning: false,
    processName: "",
  };

  if (game) {
    state.game = game;
  }

  return state;
}

function createStoppedPoeProcessStates(): PoeProcessStatesByGame {
  return {
    poe1: createStoppedPoeProcessState("poe1"),
    poe2: createStoppedPoeProcessState("poe2"),
  };
}

function createPoeProcessSnapshot(
  states: PoeProcessStatesByGame = createStoppedPoeProcessStates(),
  activeGame: GameId | null = null,
): PoeProcessSnapshot {
  return {
    activeGame,
    activeState: resolvePoeProcessSnapshotActiveState(states, activeGame),
    states,
  };
}

function resolvePoeProcessSnapshotActiveState(
  states: PoeProcessStatesByGame,
  activeGame: GameId | null,
): PoeProcessState {
  if (activeGame) {
    const state = states[activeGame];

    return state?.isRunning ? state : createStoppedPoeProcessState();
  }

  return (
    POE_PROCESS_GAMES.map((game) => states[game]).find(
      (state) => state.isRunning,
    ) ?? createStoppedPoeProcessState()
  );
}

function getPoeProcessStateForGame(
  snapshot: PoeProcessSnapshot,
  game: GameId,
): PoeProcessState {
  return snapshot.states[game] ?? createStoppedPoeProcessState(game);
}

function isPoeProcessSnapshotRunningForGame(
  snapshot: PoeProcessSnapshot,
  game: GameId,
): boolean {
  return getPoeProcessStateForGame(snapshot, game).isRunning;
}

function hasAnyRunningPoeProcess(snapshot: PoeProcessSnapshot): boolean {
  return POE_PROCESS_GAMES.some((game) =>
    isPoeProcessSnapshotRunningForGame(snapshot, game),
  );
}

export type {
  PoeProcessError,
  PoeProcessRunningState,
  PoeProcessSnapshot,
  PoeProcessState,
  PoeProcessStatesByGame,
  PoeProcessStoppedState,
};
export {
  createPoeProcessSnapshot,
  createStoppedPoeProcessState,
  createStoppedPoeProcessStates,
  getPoeProcessStateForGame,
  hasAnyRunningPoeProcess,
  isPoeProcessSnapshotRunningForGame,
  POE_PROCESS_GAMES,
};
