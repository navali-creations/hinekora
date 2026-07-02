import type { ChangeEvent } from "react";
import { useEffect } from "react";

import {
  getLeagueSettingKey,
  leagueOptions,
  normalizeLeagueForGame,
} from "~/renderer/modules/game/GameScope.constants";
import { useSettingsShallow } from "~/renderer/store";

import type { GameId } from "~/types";

interface LeagueSelectProps {
  game: GameId;
  disabled?: boolean;
}

function LeagueSelect({ disabled = false, game }: LeagueSelectProps) {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const activeGame = settingsValue?.activeGame ?? "poe1";
  const leagueKey = getLeagueSettingKey(game);
  const storedLeague = settingsValue?.[leagueKey];
  const leagues = leagueOptions[game];
  const selectedLeague = normalizeLeagueForGame(game, storedLeague);

  useEffect(() => {
    if (selectedLeague !== storedLeague) {
      void updateSettings({
        [leagueKey]: selectedLeague,
        ...(activeGame === game ? { activeLeague: selectedLeague } : {}),
      });
    }
  }, [
    activeGame,
    game,
    leagueKey,
    selectedLeague,
    storedLeague,
    updateSettings,
  ]);

  const handleLeagueChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLeague = event.target.value;

    void updateSettings({
      [leagueKey]: nextLeague,
      ...(activeGame === game ? { activeLeague: nextLeague } : {}),
    });
  };

  return (
    <label
      className="select select-xs w-max no-drag"
      aria-label={`${game} league`}
    >
      <span className="label">League</span>
      <select
        className="-me-[30px] -ms-[18px]"
        disabled={disabled}
        value={selectedLeague}
        onChange={handleLeagueChange}
      >
        {leagues.map((league) => (
          <option key={league} value={league}>
            {league}
          </option>
        ))}
      </select>
    </label>
  );
}

export { LeagueSelect };
