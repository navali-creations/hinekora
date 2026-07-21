import { useNavigate } from "@tanstack/react-router";
import { FiArrowRight as ArrowRight } from "react-icons/fi";

import { NoticeAlert } from "~/renderer/components/NoticeAlert/NoticeAlert";
import { useSettingsShallow } from "~/renderer/store";

import type { GameId } from "~/types";

function GroupPlayDeathAlert() {
  const navigate = useNavigate();
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));

  if (!settingsValue || settingsValue.groupPlayDeathAlertDismissed) {
    return null;
  }

  const characterNames: Record<GameId, string> = {
    poe1: settingsValue.poe1CharacterName ?? "",
    poe2: settingsValue.poe2CharacterName ?? "",
  };
  const needsCharacterName = (settingsValue.installedGames ?? []).some(
    (game) => characterNames[game].trim().length === 0,
  );

  if (!needsCharacterName) {
    return null;
  }

  const handleOpenGameSettings = () => {
    void navigate({
      to: "/settings",
      search: {
        tab: "game",
      },
    });
  };

  const handleDismiss = () => {
    void updateSettings({
      groupPlayDeathAlertDismissed: true,
    });
  };

  return (
    <NoticeAlert
      actions={
        <button
          className="btn btn-warning btn-xs"
          type="button"
          onClick={handleOpenGameSettings}
        >
          Game Settings
          <ArrowRight size={14} />
        </button>
      }
      dismissLabel="Dismiss group play death clip alert"
      onDismiss={handleDismiss}
      title="Playing in a group?"
      tone="warning"
    >
      <p className="m-0">
        Add your character name so Hinekora can ignore teammate death lines and
        create death clips only for you.
      </p>
    </NoticeAlert>
  );
}

export { GroupPlayDeathAlert };
