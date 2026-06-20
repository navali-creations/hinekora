import type { ChangeEvent } from "react";

import {
  useManagedRecorderSelector,
  useSettingsShallow,
} from "~/renderer/store";

import {
  normalizeRecordingEncoderChoice,
  type RecordingEncoderChoice,
  RecordingEncoderOptions,
  type RecordingQuality,
} from "~/types";

const recordingResolutionOptions = [
  { value: "native", label: "Native source" },
  { value: "1920x1080", label: "1920 x 1080" },
  { value: "2560x1440", label: "2560 x 1440" },
  { value: "3440x1440", label: "3440 x 1440" },
  { value: "3840x2160", label: "3840 x 2160" },
];
const recordingFpsOptions = [30, 60];
const recordingQualityOptions = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "ultra", label: "Ultra" },
] as const;

function RecordingSettingsCard() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const status = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const isRecording = status?.recording === true;
  const isBusy =
    status?.isStartingRecording === true ||
    status?.isStoppingRecording === true;

  const handleResolutionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({ recordingOutputResolution: event.target.value });
  };

  const handleFpsChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({ recordingFps: Number(event.target.value) });
  };

  const handleEncoderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({
      recordingEncoder: event.target.value as RecordingEncoderChoice,
    });
  };

  const handleClipQualityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({
      recordingClipQuality: event.target.value as RecordingQuality,
    });
  };

  const handleRunQualityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({
      recordingRunQuality: event.target.value as RecordingQuality,
    });
  };

  return (
    <section className="col-span-12 grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">Recording</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          Resolution
          <select
            className="select select-bordered w-full"
            disabled={isRecording || isBusy}
            value={settingsValue?.recordingOutputResolution ?? "native"}
            onChange={handleResolutionChange}
          >
            {recordingResolutionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          FPS
          <select
            className="select select-bordered w-full"
            disabled={isRecording || isBusy}
            value={settingsValue?.recordingFps ?? 30}
            onChange={handleFpsChange}
          >
            {recordingFpsOptions.map((fps) => (
              <option key={fps} value={fps}>
                {fps}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          Video encoder
          <select
            className="select select-bordered w-full"
            disabled={isRecording || isBusy}
            value={normalizeRecordingEncoderChoice(
              settingsValue?.recordingEncoder,
            )}
            onChange={handleEncoderChange}
          >
            {RecordingEncoderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          Clip quality
          <select
            className="select select-bordered w-full"
            disabled={isRecording || isBusy}
            value={settingsValue?.recordingClipQuality ?? "high"}
            onChange={handleClipQualityChange}
          >
            {recordingQualityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          Run quality
          <select
            className="select select-bordered w-full"
            disabled={isRecording || isBusy}
            value={settingsValue?.recordingRunQuality ?? "moderate"}
            onChange={handleRunQualityChange}
          >
            {recordingQualityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export { RecordingSettingsCard };
