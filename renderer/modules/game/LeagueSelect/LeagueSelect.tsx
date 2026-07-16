import type { ChangeEvent } from "react";
import { useEffect } from "react";

import { normalizeLeagueForGame } from "~/renderer/modules/game/GameScope.constants";
import { usePoeLeaguesShallow, useSettingsShallow } from "~/renderer/store";

import {
  canNormalizePoeLeagueSelection,
  type GameId,
  getLeagueSettingKey,
} from "~/types";

interface LeagueSelectProps {
  game: GameId;
  disabled?: boolean;
}

function LeagueSelect({ disabled = false, game }: LeagueSelectProps) {
  const { preferenceError, settingsValue, updatePreference } =
    useSettingsShallow((settings) => ({
      preferenceError:
        settings.preferenceErrors[getLeagueSettingKey(game)] ?? null,
      settingsValue: settings.value,
      updatePreference: settings.updatePreference,
    }));
  const { isFetching, leagueItems, syncStatus } = usePoeLeaguesShallow(
    (poeLeagues) => ({
      isFetching: poeLeagues.isFetchingByGame[game],
      leagueItems: poeLeagues.byGame[game],
      syncStatus: poeLeagues.statusByGame[game],
    }),
  );
  const leagues = leagueItems.map((league) => league.name);
  const leagueKey = getLeagueSettingKey(game);
  const storedLeague = settingsValue?.[leagueKey];
  const selectedLeague = normalizeLeagueForGame(game, storedLeague, leagues);
  const canNormalizeSelection = canNormalizePoeLeagueSelection(syncStatus);

  useEffect(() => {
    if (canNormalizeSelection && selectedLeague !== storedLeague) {
      void updatePreference(leagueKey, selectedLeague);
    }
  }, [
    canNormalizeSelection,
    leagueKey,
    selectedLeague,
    storedLeague,
    updatePreference,
  ]);

  const handleLeagueChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLeague = event.target.value;

    void updatePreference(leagueKey, nextLeague);
  };

  return (
    <label
      className="select select-xs w-max cursor-pointer no-drag focus-within:outline-none focus-within:ring-0"
      aria-label={`${game} league`}
    >
      <span className="label">League</span>
      <select
        aria-invalid={preferenceError ? true : undefined}
        className="-me-[30px] -ms-[18px] cursor-pointer outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
        disabled={disabled || isFetching}
        title={preferenceError ?? undefined}
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
