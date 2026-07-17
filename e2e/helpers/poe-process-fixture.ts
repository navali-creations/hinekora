import type {
  PoeProcessRunningState,
  PoeProcessSnapshot,
  PoeProcessState,
  PoeProcessStatesByGame,
} from "../../main/modules/poe-process/PoeProcess.dto";
import type { GameId } from "../../types";

interface E2ERunningPoeProcessStateInput {
  game: GameId;
  pid?: number;
  processName?: string;
  windowTitle?: string;
}

interface PoeProcessVariant {
  game: GameId;
  id: string;
  name: string;
  processName: string;
}

function e2ePoeProcessSnapshotFactory() {
  const games = ["poe1", "poe2"] as const;

  const createStoppedPoeProcessState = (game?: GameId): PoeProcessState => {
    const state: PoeProcessState = {
      isRunning: false,
      processName: "",
    };

    if (game) {
      state.game = game;
    }

    return state;
  };

  const createStoppedPoeProcessStates = (): PoeProcessStatesByGame => ({
    poe1: createStoppedPoeProcessState("poe1"),
    poe2: createStoppedPoeProcessState("poe2"),
  });

  const createRunningPoeProcessState = (
    input: GameId | E2ERunningPoeProcessStateInput,
  ): PoeProcessRunningState => {
    const stateInput = typeof input === "string" ? { game: input } : input;

    return {
      game: stateInput.game,
      isRunning: true,
      pid: stateInput.pid ?? (stateInput.game === "poe2" ? 4242 : 4241),
      processName:
        stateInput.processName ??
        (stateInput.game === "poe2"
          ? "PathOfExileSteam.exe"
          : "PathOfExile.exe"),
      windowTitle:
        stateInput.windowTitle ??
        (stateInput.game === "poe2" ? "Path of Exile 2" : "Path of Exile"),
    };
  };

  const resolveActiveState = (
    states: PoeProcessStatesByGame,
    activeGame: GameId | null,
  ): PoeProcessState => {
    if (activeGame) {
      const activeState = states[activeGame];

      return activeState.isRunning
        ? activeState
        : createStoppedPoeProcessState();
    }

    return (
      games.map((game) => states[game]).find((state) => state.isRunning) ??
      createStoppedPoeProcessState()
    );
  };

  const createPoeProcessSnapshot = (
    states: PoeProcessStatesByGame = createStoppedPoeProcessStates(),
    activeGame: GameId | null = null,
  ): PoeProcessSnapshot => ({
    activeGame,
    activeState: resolveActiveState(states, activeGame),
    states,
  });

  const createPoeProcessSnapshotFromState = (
    state: PoeProcessState,
    activeGame: GameId | null = state.game ?? null,
  ): PoeProcessSnapshot => {
    const states = createStoppedPoeProcessStates();
    if (state.isRunning && state.game) {
      states[state.game] = createRunningPoeProcessState(state);
    }

    return createPoeProcessSnapshot(states, activeGame);
  };

  return {
    createPoeProcessSnapshot,
    createPoeProcessSnapshotFromState,
    createRunningPoeProcessState,
    createStoppedPoeProcessStates,
  };
}

type E2EPoeProcessSnapshotFactory = ReturnType<
  typeof e2ePoeProcessSnapshotFactory
>;

const e2ePoeProcessSnapshotFactorySource =
  e2ePoeProcessSnapshotFactory.toString();
const e2ePoeProcessSnapshotFactoryScript = `"use strict"; return (${e2ePoeProcessSnapshotFactorySource});`;
const poeProcessStateFactory = e2ePoeProcessSnapshotFactory();
const poeProcessVariants: PoeProcessVariant[] = [
  {
    game: "poe1",
    id: "poe1-steam",
    name: "Path of Exile 1 Steam",
    processName: "PathOfExileSteam.exe",
  },
  {
    game: "poe1",
    id: "poe1-standalone",
    name: "Path of Exile 1 standalone",
    processName: "PathOfExile.exe",
  },
  {
    game: "poe2",
    id: "poe2-steam",
    name: "Path of Exile 2 Steam",
    processName: "PathOfExileSteam.exe",
  },
  {
    game: "poe2",
    id: "poe2-standalone",
    name: "Path of Exile 2 standalone",
    processName: "PathOfExile.exe",
  },
];

function createPoeProcessState(
  input: Pick<PoeProcessVariant, "game" | "processName">,
): PoeProcessState {
  return poeProcessStateFactory.createRunningPoeProcessState(input);
}

export type { E2EPoeProcessSnapshotFactory, PoeProcessVariant };
export {
  createPoeProcessState,
  e2ePoeProcessSnapshotFactoryScript,
  poeProcessVariants,
};
