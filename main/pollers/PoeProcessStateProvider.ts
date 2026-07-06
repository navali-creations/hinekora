import {
  createStoppedPoeProcessState,
  type PoeProcessState,
} from "~/main/modules/poe-process/PoeProcess.dto";

import type { GameId } from "~/types";

interface PoeProcessStateProvider {
  refreshState(preferredGame: GameId | null): Promise<PoeProcessState>;
}

let provider: PoeProcessStateProvider | null = null;

function setPoeProcessStateProvider(
  nextProvider: PoeProcessStateProvider,
): void {
  provider = nextProvider;
}

function clearPoeProcessStateProvider(
  providerToClear?: PoeProcessStateProvider,
): void {
  if (!providerToClear || provider === providerToClear) {
    provider = null;
  }
}

async function refreshPoeProcessState(
  preferredGame: GameId | null = null,
): Promise<PoeProcessState> {
  return (
    provider?.refreshState(preferredGame) ?? createStoppedPoeProcessState()
  );
}

function isProcessStateForGame(state: PoeProcessState, game: GameId): boolean {
  return state.isRunning && state.game === game;
}

export type { PoeProcessStateProvider };
export {
  clearPoeProcessStateProvider,
  isProcessStateForGame,
  refreshPoeProcessState,
  setPoeProcessStateProvider,
};
