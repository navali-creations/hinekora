import clsx from "clsx";

import { gameOptions } from "~/renderer/modules/game/GameScope.constants";
import { GameStatusBadge } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge";
import { LeagueSelect } from "~/renderer/modules/game/LeagueSelect/LeagueSelect";
import {
  useCaptureProfilesShallow,
  useClientLogSelector,
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
  const activeGame = settingsValue?.activeGame ?? "poe1";
  const isActive = activeGame === game;
  const label = gameOptions.find((option) => option.id === game)?.label ?? game;

  const handleGameSelect = async () => {
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
        className="no-drag btn btn-ghost p-0 hover:bg-transparent focus-visible:bg-transparent"
        type="button"
        onClick={handleGameSelect}
      >
        <span className="font-[Fontin]">{label}</span>
        <GameStatusBadge game={game} />
      </button>
      <LeagueSelect game={game} />
    </div>
  );
}

export { GameSelectorTab };
