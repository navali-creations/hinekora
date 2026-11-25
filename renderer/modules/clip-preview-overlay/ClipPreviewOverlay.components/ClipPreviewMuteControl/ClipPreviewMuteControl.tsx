import clsx from "clsx";
import { useEffect } from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";

import {
  useClipPreviewOverlayShallow,
  useSettingsShallow,
} from "~/renderer/store";

import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { resolveClipPreviewMediaState } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow.utils";
import { isClipPreviewAudioMuted } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

const blockedAudioHelp = {
  checking: {
    label: "Checking replay audio output",
    tooltip: "Checking audio output availability…",
  },
  disabled: {
    label: "Replay muted: no audio output selected",
    tooltip:
      "No audio output is selected. Stop Rewind or Recording, then select an output in Dashboard → Audio settings for future clips.",
  },
  unavailable: {
    label: "Replay muted: audio output unavailable",
    tooltip:
      "The saved audio output device is unavailable. Stop Rewind or Recording, then select an available output in Dashboard → Audio settings for future clips.",
  },
  error: {
    label: "Replay audio output could not be checked",
    tooltip:
      "Audio output availability could not be checked. Retrying automatically.",
  },
} as const;

const audioOutputRefreshMs = 5_000;

function ClipPreviewMuteControl() {
  const workflow = useClipPreviewOverlayMediaContext();
  const outputDeviceId = useSettingsShallow(
    (settings) => settings.value?.recordingAudioOutputDeviceId,
  );
  const {
    audioOutputState,
    canUseClip,
    clipId,
    isMuted,
    isProcessing,
    refreshAudioOutputState,
  } = useClipPreviewOverlayShallow((state) => {
    const { canUseClip, isProcessing } = resolveClipPreviewMediaState(state);
    return {
      audioOutputState: state.audioOutputState,
      canUseClip,
      clipId: state.detail?.clip.id,
      isMuted: isClipPreviewAudioMuted(state),
      isProcessing,
      refreshAudioOutputState: state.refreshAudioOutputState,
    };
  });
  useEffect(() => {
    if (!clipId) return;
    let active = true;
    let timer: number | undefined;
    const refresh = async (background = false) => {
      await refreshAudioOutputState(outputDeviceId, { background });
      if (active && outputDeviceId !== null) {
        timer = window.setTimeout(
          () => void refresh(true),
          audioOutputRefreshMs,
        );
      }
    };
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [clipId, outputDeviceId, refreshAudioOutputState]);

  const blocked = audioOutputState !== "available";
  const label = blocked
    ? blockedAudioHelp[audioOutputState].label
    : isMuted
      ? "Unmute replay"
      : "Mute replay";
  const tooltip = blocked
    ? blockedAudioHelp[audioOutputState].tooltip
    : isMuted
      ? "Unmute"
      : "Mute";
  const handleToggleMuted = () => {
    if (!blocked) workflow.handleToggleMuted();
  };

  return (
    <span
      aria-label={blocked ? label : undefined}
      className={clsx(styles.muteButton, "tooltip tooltip-right inline-flex", {
        "cursor-help": blocked,
      })}
      data-tip={tooltip}
      role={blocked ? "group" : undefined}
      tabIndex={blocked ? 0 : undefined}
    >
      <button
        aria-description={blocked ? tooltip : undefined}
        aria-disabled={blocked}
        aria-label={label}
        aria-pressed={isMuted}
        className={clsx(
          styles.videoIconButton,
          styles.videoSecondaryButton,
          isMuted && !blocked && styles.videoSecondaryButtonActive,
          "btn btn-circle btn-sm disabled:opacity-45",
        )}
        data-tip={tooltip}
        disabled={blocked || !canUseClip || isProcessing}
        type="button"
        onClick={handleToggleMuted}
      >
        {isMuted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
      </button>
    </span>
  );
}

export { ClipPreviewMuteControl };
