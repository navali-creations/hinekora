import type { ChangeEvent } from "react";
import { FiInfo } from "react-icons/fi";

import type { AudioDeviceOption } from "../ManagedRecorderAudioSettingsCard/ManagedRecorderAudioSettingsCard.utils";
import { resolveAudioOptionTitle } from "../ManagedRecorderAudioSettingsCard/ManagedRecorderAudioSettingsCard.utils";

const audioFieldHelp = {
  input:
    "Captures microphone or line-in audio when an input device is selected.",
  output: "Captures desktop playback audio when an output device is selected.",
} as const;

interface ManagedRecorderAudioDeviceSelectsProps {
  audioInputOptions: AudioDeviceOption[];
  audioInputValue: string;
  audioOutputOptions: AudioDeviceOption[];
  audioOutputValue: string;
  disabled: boolean;
  onAudioInputChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onAudioOutputChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function ManagedRecorderAudioDeviceSelects({
  audioInputOptions,
  audioInputValue,
  audioOutputOptions,
  audioOutputValue,
  disabled,
  onAudioInputChange,
  onAudioOutputChange,
}: ManagedRecorderAudioDeviceSelectsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          Audio input
          <span
            aria-label={audioFieldHelp.input}
            className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={audioFieldHelp.input}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <select
          className="select select-bordered select-sm w-full min-w-0 truncate pr-8"
          disabled={disabled}
          title={resolveAudioOptionTitle(audioInputOptions, audioInputValue)}
          value={audioInputValue}
          onChange={onAudioInputChange}
        >
          {audioInputOptions.map((option, index) => (
            <option
              key={`${option.value}:${index}`}
              title={option.title}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          Audio output
          <span
            aria-label={audioFieldHelp.output}
            className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={audioFieldHelp.output}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <select
          className="select select-bordered select-sm w-full min-w-0 truncate pr-8"
          disabled={disabled}
          title={resolveAudioOptionTitle(audioOutputOptions, audioOutputValue)}
          value={audioOutputValue}
          onChange={onAudioOutputChange}
        >
          {audioOutputOptions.map((option, index) => (
            <option
              key={`${option.value}:${index}`}
              title={option.title}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export { ManagedRecorderAudioDeviceSelects };
