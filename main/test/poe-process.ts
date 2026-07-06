import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  type PoeProcessRunningState,
  type PoeProcessSnapshot,
  type PoeProcessState,
  type PoeProcessStatesByGame,
} from "~/main/modules/poe-process/PoeProcess.dto";

import type { GameId } from "~/types";

interface CreateRunningPoeProcessStateInput {
  game: GameId;
  isRunning?: boolean;
  pid?: number;
  processName?: string;
  windowTitle?: string;
}

function createRunningPoeProcessState(
  input: GameId | CreateRunningPoeProcessStateInput,
): PoeProcessRunningState {
  const stateInput =
    typeof input === "string"
      ? {
          game: input,
        }
      : input;

  return {
    game: stateInput.game,
    isRunning: true,
    pid: stateInput.pid ?? (stateInput.game === "poe2" ? 4242 : 4241),
    processName:
      stateInput.processName ??
      (stateInput.game === "poe2" ? "PathOfExileSteam.exe" : "PathOfExile.exe"),
    windowTitle:
      stateInput.windowTitle ??
      (stateInput.game === "poe2" ? "Path of Exile 2" : "Path of Exile"),
  };
}

function createPoeProcessStatesWithState(
  state: PoeProcessState | CreateRunningPoeProcessStateInput,
): PoeProcessStatesByGame {
  const states = createStoppedPoeProcessStates();
  if (!state.game) {
    return states;
  }

  if ("isRunning" in state && state.isRunning === false) {
    return states;
  }

  states[state.game] = createRunningPoeProcessState(state);

  return states;
}

function createPoeProcessSnapshotFromState(
  state: PoeProcessState | CreateRunningPoeProcessStateInput,
  activeGame: GameId | null = state.game ?? null,
): PoeProcessSnapshot {
  return createPoeProcessSnapshot(
    createPoeProcessStatesWithState(state),
    activeGame,
  );
}

export type { CreateRunningPoeProcessStateInput };
export {
  createPoeProcessSnapshotFromState,
  createPoeProcessStatesWithState,
  createRunningPoeProcessState,
};
