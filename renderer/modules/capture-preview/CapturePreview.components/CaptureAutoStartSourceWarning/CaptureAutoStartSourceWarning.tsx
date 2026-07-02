import { FiAlertTriangle } from "react-icons/fi";

import {
  isCapturePreviewSourceAvailable,
  isUnavailableGameWindowFallbackSource,
  sourceMatchesCaptureTarget,
} from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { resolveActiveGameCaptureProfile } from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { getGameLabel } from "~/renderer/modules/game/GameScope.constants";
import {
  useCapturePreviewShallow,
  useCaptureProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

function CaptureAutoStartSourceWarning() {
  const { selectedSourceId, sources } = useCapturePreviewShallow(
    (capturePreview) => ({
      selectedSourceId: capturePreview.selectedSourceId,
      sources: capturePreview.sources,
    }),
  );
  const { profileItems, selectedProfileId } = useCaptureProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
    }),
  );
  const settingsValue = useSettingsSelector((settings) => settings.value);
  const activeGame = settingsValue?.activeGame ?? "poe1";
  const selectedProfile = resolveActiveGameCaptureProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
  const captureTarget = selectedProfile?.captureTarget ?? null;
  const autoStartMode = settingsValue?.recordingAutoStartMode ?? "off";
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedUnavailableGame =
    selectedSource && isUnavailableGameWindowFallbackSource(selectedSource)
      ? selectedSource.game
      : null;

  const targetAvailable = sources.some(
    (source) =>
      isCapturePreviewSourceAvailable(source) &&
      sourceMatchesCaptureTarget(source, captureTarget),
  );
  if (
    !selectedUnavailableGame &&
    (captureTarget?.kind !== "window" || targetAvailable)
  ) {
    return null;
  }

  const game =
    selectedUnavailableGame ??
    captureTarget?.game ??
    selectedProfile?.game ??
    activeGame;
  const gameLabel = getGameLabel(game);
  if (autoStartMode === "off") {
    if (!selectedUnavailableGame) {
      return null;
    }

    return (
      <div
        className="alert alert-warning grid grid-cols-[auto_minmax(0,1fr)] gap-2 py-2 text-[0.8125rem] leading-snug"
        role="status"
      >
        <FiAlertTriangle className="h-4 w-4" />
        <span>
          {gameLabel} is currently unavailable. It will be available once you
          launch the game.
        </span>
      </div>
    );
  }

  const autoStartLabel = autoStartMode === "recording" ? "recording" : "rewind";

  return (
    <div
      className="alert alert-warning grid grid-cols-[auto_minmax(0,1fr)] gap-2 py-2 text-[0.8125rem] leading-snug"
      role="status"
    >
      <FiAlertTriangle className="h-4 w-4" />
      <span>
        Automatic {autoStartLabel} will continue once {gameLabel} is running and
        the selected window is available.
      </span>
    </div>
  );
}

export { CaptureAutoStartSourceWarning };
