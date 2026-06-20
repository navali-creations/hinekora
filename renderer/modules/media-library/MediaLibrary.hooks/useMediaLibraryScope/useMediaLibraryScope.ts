import { useCallback, useEffect, useState } from "react";

import {
  getLeagueSettingKey,
  normalizeLeagueForGame,
} from "~/renderer/modules/game/GameScope.constants";
import { useSettingsSelector } from "~/renderer/store";

import {
  ALL_LEAGUES_VALUE,
  type MediaLibraryScope,
} from "../../MediaLibrary.utils/MediaLibrary.utils";

function useMediaLibraryScope(): {
  scope: MediaLibraryScope;
  setLeague: (league: string) => void;
} {
  const settings = useSettingsSelector((settingsSlice) => settingsSlice.value);
  const [scope, setScope] = useState<MediaLibraryScope>({
    game: "poe1",
    league: "Standard",
  });

  useEffect(() => {
    if (!settings) {
      return;
    }

    const activeGame = settings.activeGame;
    const leagueKey = getLeagueSettingKey(activeGame);
    setScope((current) => {
      const nextLeague =
        current.league === ALL_LEAGUES_VALUE
          ? ALL_LEAGUES_VALUE
          : current.game === activeGame
            ? current.league
            : normalizeLeagueForGame(activeGame, settings[leagueKey]);

      return {
        game: activeGame,
        league:
          nextLeague === ALL_LEAGUES_VALUE
            ? ALL_LEAGUES_VALUE
            : normalizeLeagueForGame(activeGame, nextLeague),
      };
    });
  }, [settings]);

  const setLeague = useCallback((league: string) => {
    setScope((current) => ({ ...current, league }));
  }, []);

  return { scope, setLeague };
}

export { useMediaLibraryScope };
