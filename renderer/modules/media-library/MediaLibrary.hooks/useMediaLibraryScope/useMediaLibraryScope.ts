import { useCallback, useEffect, useState } from "react";

import {
  getLeagueSettingKey,
  normalizeLeagueForGame,
} from "~/renderer/modules/game/GameScope.constants";
import { useSettingsSelector } from "~/renderer/store";

import type { AppSettings, GameId } from "~/types";
import {
  ALL_LEAGUES_VALUE,
  type MediaLibraryScope,
} from "../../MediaLibrary.utils/MediaLibrary.utils";

function createMediaLibraryScopeFromSettings(
  settings: Partial<AppSettings> | null,
): MediaLibraryScope {
  if (!settings) {
    return {
      game: "poe1",
      league: "Standard",
    };
  }

  const activeGame = settings.activeGame ?? "poe1";
  return {
    game: activeGame,
    league: normalizeLeagueForGame(
      activeGame,
      settings[getLeagueSettingKey(activeGame)],
    ),
  };
}

function syncMediaLibraryScopeWithSettings(
  settings: Partial<AppSettings> & Pick<AppSettings, "activeGame">,
  currentScope: MediaLibraryScope,
): MediaLibraryScope {
  const activeGame = settings.activeGame;
  const leagueKey = getLeagueSettingKey(activeGame);
  const nextLeague =
    currentScope.league === ALL_LEAGUES_VALUE
      ? ALL_LEAGUES_VALUE
      : currentScope.game === activeGame
        ? currentScope.league
        : normalizeLeagueForGame(activeGame, settings[leagueKey]);

  return {
    game: activeGame,
    league:
      nextLeague === ALL_LEAGUES_VALUE
        ? ALL_LEAGUES_VALUE
        : normalizeLeagueForGame(activeGame, nextLeague),
  };
}

function hasMediaLibrarySettings(
  settings: Partial<AppSettings> | null,
): settings is Partial<AppSettings> & Pick<AppSettings, "activeGame"> {
  return settings?.activeGame === "poe1" || settings?.activeGame === "poe2";
}

function useMediaLibraryScope(): {
  isReady: boolean;
  scope: MediaLibraryScope;
  setLeague: (league: string) => void;
} {
  const settings = useSettingsSelector((settingsSlice) => settingsSlice.value);
  const mediaLibrarySettings = hasMediaLibrarySettings(settings)
    ? settings
    : null;
  const [scope, setScope] = useState<MediaLibraryScope>(() =>
    createMediaLibraryScopeFromSettings(mediaLibrarySettings),
  );
  const [syncedSettingsGame, setSyncedSettingsGame] = useState<GameId | null>(
    () => mediaLibrarySettings?.activeGame ?? null,
  );

  useEffect(() => {
    if (!mediaLibrarySettings) {
      return;
    }

    setScope((current) =>
      syncMediaLibraryScopeWithSettings(mediaLibrarySettings, current),
    );
    setSyncedSettingsGame(mediaLibrarySettings.activeGame);
  }, [mediaLibrarySettings]);

  const setLeague = useCallback((league: string) => {
    setScope((current) => ({ ...current, league }));
  }, []);

  const isSyncedWithSettings =
    mediaLibrarySettings !== null &&
    syncedSettingsGame === mediaLibrarySettings.activeGame;
  const renderedScope =
    mediaLibrarySettings && !isSyncedWithSettings
      ? syncMediaLibraryScopeWithSettings(mediaLibrarySettings, scope)
      : scope;

  return {
    isReady: mediaLibrarySettings !== null,
    scope: renderedScope,
    setLeague,
  };
}

export { useMediaLibraryScope };
