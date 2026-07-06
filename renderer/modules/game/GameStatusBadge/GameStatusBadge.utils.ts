import type {
  PoeProcessState,
  PoeProcessStatesByGame,
} from "~/main/modules/poe-process/PoeProcess.dto";

import type { GameId } from "~/types";

function isPoeProcessStateForGame(
  state: PoeProcessState | PoeProcessStatesByGame | null,
  game: GameId,
): boolean {
  if (state && "poe1" in state && "poe2" in state) {
    return state[game].isRunning;
  }

  return state?.isRunning === true && state.game === game;
}

export { isPoeProcessStateForGame };
