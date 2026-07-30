import clsx from "clsx";
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

import {
  clampRewindSaveSeconds,
  defaultRewindSaveSeconds,
  rewindDurationPresetSeconds,
} from "~/types";
import { useManagedRecorderSettingsDisabled } from "../../ManagedRecorder.hooks/useManagedRecorderSettingsDisabled/useManagedRecorderSettingsDisabled";

type RewindDurationSettingKey = "deathClipSeconds" | "manualReplaySeconds";

interface ManagedRecorderRewindDurationFieldProps {
  helpText: string;
  label: string;
  settingKey: RewindDurationSettingKey;
}

function ManagedRecorderRewindDurationField({
  helpText,
  label,
  settingKey,
}: ManagedRecorderRewindDurationFieldProps) {
  const disabled = useManagedRecorderSettingsDisabled();
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const selectedSeconds = clampRewindSaveSeconds(
    settingsValue?.[settingKey] ?? defaultRewindSaveSeconds,
  );
  const selectedSecondsIsPreset = (
    rewindDurationPresetSeconds as readonly number[]
  ).includes(selectedSeconds);
  const [draftSeconds, setDraftSeconds] = useState(String(selectedSeconds));
  const [isCustomDurationEditing, setIsCustomDurationEditing] = useState(false);
  const showCustomDurationInput =
    isCustomDurationEditing || !selectedSecondsIsPreset;

  useEffect(() => {
    setDraftSeconds(String(selectedSeconds));
    if (selectedSecondsIsPreset) {
      setIsCustomDurationEditing(false);
    }
  }, [selectedSeconds, selectedSecondsIsPreset]);

  const commitSeconds = (seconds: number) => {
    if (disabled) {
      return;
    }

    const nextSeconds = clampRewindSaveSeconds(seconds);
    setDraftSeconds(String(nextSeconds));
    void updateSettings(
      settingKey === "deathClipSeconds"
        ? { deathClipSeconds: nextSeconds }
        : { manualReplaySeconds: nextSeconds },
    );
  };

  const handlePresetClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    const seconds = Number(event.currentTarget.dataset.seconds);
    if (Number.isFinite(seconds)) {
      setIsCustomDurationEditing(false);
      commitSeconds(seconds);
    }
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      setDraftSeconds(event.target.value.replace(/\D/g, "").slice(0, 2));
    }
  };

  const handleDurationFocus = () => {
    if (!disabled && !showCustomDurationInput) {
      setIsCustomDurationEditing(true);
      setDraftSeconds("");
    }
  };

  const handleDurationBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    if (event.target.value.trim() === "") {
      setDraftSeconds(String(selectedSeconds));
      setIsCustomDurationEditing(!selectedSecondsIsPreset);
      return;
    }

    const seconds = Number(event.target.value);
    if (Number.isFinite(seconds)) {
      commitSeconds(seconds);
    } else {
      setDraftSeconds(String(selectedSeconds));
    }
  };

  const handleDurationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  return (
    <div className="grid gap-1.5 text-primary text-[0.8125rem]">
      <span className="inline-flex items-center gap-1">
        {label}
        <span
          aria-label={helpText}
          className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
          data-tip={helpText}
          role="img"
          tabIndex={0}
        >
          <FiInfo className="h-3.5 w-3.5" />
        </span>
      </span>
      <div
        aria-label={`${label} controls`}
        className="join flex w-full flex-nowrap"
      >
        <input
          aria-label={`${label} seconds`}
          className={clsx(
            "input input-bordered input-sm join-item h-8 min-w-0 flex-1 basis-0 px-2 text-center focus:outline-none focus:ring-0 focus-visible:outline-none",
            {
              "border-primary bg-primary text-primary-content placeholder:text-primary-content/60":
                showCustomDurationInput,
              "border-base-content/20 bg-base-200 text-base-content/60":
                !showCustomDurationInput,
            },
          )}
          disabled={disabled}
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
            !showCustomDurationInput && selectedSeconds === seconds;

          return (
            <button
              aria-label={`${seconds} second ${label.toLowerCase()}`}
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
              disabled={disabled}
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
  );
}

export { ManagedRecorderRewindDurationField };
