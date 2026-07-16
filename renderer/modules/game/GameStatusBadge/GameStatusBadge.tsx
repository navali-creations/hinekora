import clsx from "clsx";
import {
  FiCheckCircle as CheckCircle,
  FiSlash as CircleSlash,
  FiRefreshCcw as RefreshCcw,
} from "react-icons/fi";

import {
  usePoeLeaguesShallow,
  usePoeProcessSelector,
  useSettingsSelector,
} from "~/renderer/store";

import type { GameId } from "~/types";
import { isPoeProcessStateForGame } from "./GameStatusBadge.utils";

interface GameStatusBadgeProps {
  game: GameId;
}

function GameStatusBadge({ game }: GameStatusBadgeProps) {
  const processStates = usePoeProcessSelector(
    (poeProcess) => poeProcess.states,
  );
  const settings = useSettingsSelector((settingsSlice) => settingsSlice.value);
  const isFetching = usePoeLeaguesShallow(
    (poeLeagues) => poeLeagues.isFetchingByGame[game],
  );
  const isRunning = isPoeProcessStateForGame(processStates, game);
  const hasPath =
    game === "poe1"
      ? Boolean(settings?.poe1ClientTxtPath)
      : Boolean(settings?.poe2ClientTxtPath);
  const label = isFetching ? "Fetching" : isRunning ? "Running" : "Offline";
  const title = hasPath ? label : `${label}; Client.txt is not configured`;

  return (
    <span
      className={clsx("game-status-badge badge badge-xs gap-1", {
        "border-emerald-400/45 bg-emerald-500/15 text-emerald-300":
          isRunning && !isFetching,
        "badge-info badge-soft": isFetching,
        "border-zinc-500/30 bg-zinc-500/10 text-zinc-400":
          !isRunning && !isFetching,
      })}
      title={title}
    >
      {isFetching ? (
        <RefreshCcw className="animate-spin" size={12} />
      ) : isRunning ? (
        <CheckCircle size={12} />
      ) : (
        <CircleSlash size={12} />
      )}
      {label}
    </span>
  );
}

export { GameStatusBadge };
