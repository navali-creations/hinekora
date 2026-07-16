import clsx from "clsx";

import { gameOptions } from "~/renderer/modules/game/GameScope.constants";
import { GameStatusBadge } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge";
import { LeagueSelect } from "~/renderer/modules/game/LeagueSelect/LeagueSelect";
import { useManagedRecorderActive } from "~/renderer/modules/managed-recorder/ManagedRecorder.hooks/useManagedRecorderActive/useManagedRecorderActive";
import {
  useCaptureProfilesShallow,
  useClientLogSelector,
  useManagedRecorderShallow,
  useSettingsShallow,
} from "~/renderer/store";

import type { GameId } from "~/types";
import styles from "./GameSelectorTab.module.css";

interface GameSelectorTabProps {
  game: GameId;
}

function GameSelectorTab({ game }: GameSelectorTabProps) {
  const { settingsValue } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
  }));
  const setActiveClientLogGame = useClientLogSelector(
    (clientLog) => clientLog.setActiveGame,
  );
  const { selectCaptureProfileForGame } = useCaptureProfilesShallow(
    (captureProfiles) => ({
      selectCaptureProfileForGame: captureProfiles.selectForGame,
    }),
  );
  const isRecorderActive = useManagedRecorderActive();
  const activeRecorderGame = useManagedRecorderShallow(
    (managedRecorder) => managedRecorder.status?.activeGame ?? null,
  );
  const activeGame = settingsValue?.activeGame ?? "poe1";
  const lockedGame = isRecorderActive
    ? (activeRecorderGame ?? activeGame)
    : null;
  const displayedActiveGame = lockedGame ?? activeGame;
  const isActive = displayedActiveGame === game;
  const isGameSwitchDisabled = lockedGame !== null && lockedGame !== game;
  const label = gameOptions.find((option) => option.id === game)?.label ?? game;

  const handleGameSelect = async () => {
    if (isGameSwitchDisabled) {
      return;
    }

    await selectCaptureProfileForGame(game);
    await setActiveClientLogGame(game, { hydrateSettings: false });
  };

  return (
    <div
      className={clsx(
        { "tab-active": isActive },
        "tab relative gap-2",
        styles.tabBorderHalf,
      )}
      role="tab"
    >
      <button
        className="no-drag btn btn-ghost border-0 p-0 shadow-none outline-none hover:bg-transparent focus:bg-transparent focus:outline-none focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isGameSwitchDisabled}
        title={
          isGameSwitchDisabled
            ? "Stop recording or rewind before switching games"
            : undefined
        }
        type="button"
        onClick={handleGameSelect}
      >
        <span className="font-[Fontin]">{label}</span>
        <GameStatusBadge game={game} />
      </button>
      <LeagueSelect disabled={isGameSwitchDisabled} game={game} />
    </div>
  );
}

export { GameSelectorTab };
