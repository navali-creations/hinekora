import clsx from "clsx";
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

import {
  clampRewindSaveSeconds,
  defaultRewindSaveSeconds,
  maxRewindSaveSeconds,
  rewindBufferSeconds,
  rewindDurationPresetSeconds,
} from "~/types";
import { ManagedRecorderAutoStartToggle } from "../ManagedRecorderAutoStartToggle/ManagedRecorderAutoStartToggle";
import { ManagedRecorderOverlayCaptureToggle } from "../ManagedRecorderOverlayCaptureToggle/ManagedRecorderOverlayCaptureToggle";

const rewindAutoStartHelp =
  "Starts the rewind buffer when Hinekora opens or when the selected game becomes available.";
const rewindDurationHelp = `Controls how many seconds are saved for death clips and manual replays. Hinekora keeps a ${rewindBufferSeconds} second rewind buffer and saves up to ${maxRewindSaveSeconds} seconds.`;
const rewindOverlayCaptureHelp =
  "Uses window capture protection so Hinekora overlays stay out of death clips, manual replays, screenshots, and external capture tools.";

function ManagedRecorderRewindSettingsFields() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const selectedRewindSeconds = clampRewindSaveSeconds(
    settingsValue?.deathClipSeconds ?? defaultRewindSaveSeconds,
  );
  const selectedRewindSecondsIsPreset = (
    rewindDurationPresetSeconds as readonly number[]
  ).includes(selectedRewindSeconds);
  const [draftSeconds, setDraftSeconds] = useState(
    String(selectedRewindSeconds),
  );
  const [isCustomDurationEditing, setIsCustomDurationEditing] = useState(false);
  const showCustomDurationInput =
    isCustomDurationEditing || !selectedRewindSecondsIsPreset;

  useEffect(() => {
    setDraftSeconds(String(selectedRewindSeconds));
    if (selectedRewindSecondsIsPreset) {
      setIsCustomDurationEditing(false);
    }
  }, [selectedRewindSeconds, selectedRewindSecondsIsPreset]);

  const commitRewindSeconds = (seconds: number) => {
    const nextSeconds = clampRewindSaveSeconds(seconds);
    setDraftSeconds(String(nextSeconds));
    void updateSettings({ deathClipSeconds: nextSeconds });
  };

  const handlePresetClick = (event: MouseEvent<HTMLButtonElement>) => {
    const seconds = Number(event.currentTarget.dataset.seconds);
    if (Number.isFinite(seconds)) {
      setIsCustomDurationEditing(false);
      commitRewindSeconds(seconds);
    }
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftSeconds(event.target.value.replace(/\D/g, "").slice(0, 2));
  };

  const handleDurationFocus = () => {
    if (!showCustomDurationInput) {
      setIsCustomDurationEditing(true);
      setDraftSeconds("");
    }
  };

  const handleDurationBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (event.target.value.trim() === "") {
      setDraftSeconds(String(selectedRewindSeconds));
      setIsCustomDurationEditing(!selectedRewindSecondsIsPreset);
      return;
    }

    const seconds = Number(event.target.value);
    if (!Number.isFinite(seconds)) {
      setDraftSeconds(String(selectedRewindSeconds));
      return;
    }

    commitRewindSeconds(seconds);
  };

  const handleDurationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.currentTarget.blur();
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          Rewind duration
          <span
            aria-label={rewindDurationHelp}
            className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={rewindDurationHelp}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <div
          aria-label="Rewind duration controls"
          className="join flex w-full flex-nowrap"
        >
          <input
            aria-label="Rewind duration seconds"
            className={clsx(
              "input input-bordered input-sm join-item h-8 min-w-0 flex-1 basis-0 px-2 text-center focus:outline-none focus:ring-0 focus-visible:outline-none",
              {
                "border-primary bg-primary text-primary-content placeholder:text-primary-content/60":
                  showCustomDurationInput,
                "border-base-content/20 bg-base-200 text-base-content/60":
                  !showCustomDurationInput,
              },
            )}
            id="rewind-duration-seconds"
            inputMode="numeric"
            maxLength={2}
            placeholder="60"
            type="text"
            value={showCustomDurationInput ? draftSeconds : ""}
            onBlur={handleDurationBlur}
            onChange={handleDurationChange}
            onFocus={handleDurationFocus}
            onKeyDown={handleDurationKeyDown}
          />
          {rewindDurationPresetSeconds.map((seconds) => {
            const isPresetSelected =
              !showCustomDurationInput && selectedRewindSeconds === seconds;

            return (
              <button
                aria-label={`${seconds} second rewind duration`}
                aria-pressed={isPresetSelected}
                className={clsx(
                  "btn join-item btn-sm h-8 min-h-0 min-w-0 flex-1 basis-0 px-1 text-xs",
                  {
                    "btn-primary": isPresetSelected,
                    "btn-outline border-base-content/20 bg-base-200":
                      !isPresetSelected,
                  },
                )}
                data-seconds={seconds}
                key={seconds}
                type="button"
                onClick={handlePresetClick}
              >
                {seconds}
              </button>
            );
          })}
          <span className="join-item flex h-8 shrink-0 items-center border border-base-content/20 bg-base-200 px-2 text-base-content/60 text-xs">
            seconds
          </span>
        </div>
      </div>

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderAutoStartToggle
          ariaLabel="Start rewind automatically"
          helpText={rewindAutoStartHelp}
          label="Start rewind automatically"
          mode="rewind"
        />
      </div>

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderOverlayCaptureToggle
          ariaLabel="Hide Hinekora overlays from rewind"
          helpText={rewindOverlayCaptureHelp}
          label="Hide overlays from rewind"
          settingKey="recordingHideOverlaysFromRewind"
        />
      </div>
    </div>
  );
}

export { ManagedRecorderRewindSettingsFields };
