import clsx from "clsx";

import {
  gameOptions,
  getLeagueSettingKey,
  normalizeLeagueForGame,
} from "~/renderer/modules/game/GameScope.constants";
import { GameStatusBadge } from "~/renderer/modules/game/GameStatusBadge/GameStatusBadge";
import { LeagueSelect } from "~/renderer/modules/game/LeagueSelect/LeagueSelect";
import { useClientLogSelector, useSettingsShallow } from "~/renderer/store";

import type { GameId } from "~/types";
import styles from "./GameSelectorTab.module.css";

interface GameSelectorTabProps {
  game: GameId;
}

function GameSelectorTab({ game }: GameSelectorTabProps) {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const setActiveClientLogGame = useClientLogSelector(
    (clientLog) => clientLog.setActiveGame,
  );
  const activeGame = settingsValue?.activeGame ?? "poe1";
  const isActive = activeGame === game;
  const label = gameOptions.find((option) => option.id === game)?.label ?? game;

  const handleGameSelect = async () => {
    const leagueKey = getLeagueSettingKey(game);
    const nextLeague = normalizeLeagueForGame(game, settingsValue?.[leagueKey]);

    await updateSettings({
      activeGame: game,
      activeLeague: nextLeague,
      [leagueKey]: nextLeague,
    });
    await setActiveClientLogGame(game);
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
