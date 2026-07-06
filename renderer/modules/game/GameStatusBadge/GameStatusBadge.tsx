import clsx from "clsx";
import {
  FiCheckCircle as CheckCircle,
  FiSlash as CircleSlash,
} from "react-icons/fi";

import { usePoeProcessSelector, useSettingsSelector } from "~/renderer/store";

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
  const isRunning = isPoeProcessStateForGame(processStates, game);
  const hasPath =
    game === "poe1"
      ? Boolean(settings?.poe1ClientTxtPath)
      : Boolean(settings?.poe2ClientTxtPath);
  const label = isRunning ? "Running" : "Offline";
  const title = hasPath ? label : `${label}; Client.txt is not configured`;

  return (
    <span
      className={clsx("game-status-badge badge badge-xs gap-1", {
        "border-emerald-400/45 bg-emerald-500/15 text-emerald-300": isRunning,
        "badge-success badge-soft": !isRunning,
      })}
      title={title}
    >
      {isRunning ? <CheckCircle size={12} /> : <CircleSlash size={12} />}
      {label}
    </span>
  );
}

export { GameStatusBadge };
