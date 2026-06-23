import clsx from "clsx";
import type { ChangeEvent, MouseEvent } from "react";
import { FiInfo } from "react-icons/fi";

import {
  useCapturePreviewShallow,
  useManagedRecorderSelector,
  useSettingsShallow,
} from "~/renderer/store";

import {
  normalizeRecordingEncoderChoice,
  type RecordingEncoderChoice,
  RecordingEncoderOptions,
  type RecordingQuality,
} from "~/types";
import { ManagedRecorderOverlayCaptureToggle } from "../ManagedRecorderOverlayCaptureToggle/ManagedRecorderOverlayCaptureToggle";

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
const recordingFieldHelp = {
  resolution: "Sets video size. Native keeps the captured source resolution.",
  fps: "Sets capture frame rate. 60 FPS is smoother and uses more disk space and GPU/CPU than 30 FPS.",
  encoder:
    "Selects the encoder used to write video files. Hardware encoders lower CPU usage when supported.",
  clipQuality: "Controls the quality and file size of short clips.",
  recordingQuality: "Controls quality and file size of full recordings.",
} as const;

function ManagedRecorderSettingsFields() {
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const nativeSourceResolution = useCapturePreviewShallow((capturePreview) => {
    const selectedSource = capturePreview.sources.find(
      (source) => source.id === capturePreview.selectedSourceId,
    );

    return selectedSource?.width && selectedSource.height
      ? `${selectedSource.width}x${selectedSource.height}`
      : null;
  });
  const status = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const isRecording = status?.recording === true;
  const isBusy =
    status?.isStartingRecording === true ||
    status?.isStoppingRecording === true;
  const selectedFps = settingsValue?.recordingFps ?? 30;
  const selectedResolution =
    settingsValue?.recordingOutputResolution ?? "native";
  const nativeSourceLabel =
    selectedResolution === "native" && nativeSourceResolution
      ? `Native source (${nativeSourceResolution})`
      : "Native source";

  const handleResolutionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({ recordingOutputResolution: event.target.value });
  };
  const handleFpsSelect = (event: MouseEvent<HTMLButtonElement>) => {
    const fps = Number(event.currentTarget.dataset.fps);
    if (recordingFpsOptions.includes(fps)) {
      void updateSettings({ recordingFps: fps });
    }
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
    <>
      <label className="grid gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          Resolution
          <span
            aria-label={recordingFieldHelp.resolution}
            className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={recordingFieldHelp.resolution}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <select
          className="select select-bordered select-sm w-full"
          disabled={isRecording || isBusy}
          value={selectedResolution}
          onChange={handleResolutionChange}
        >
          {recordingResolutionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === "native" ? nativeSourceLabel : option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          FPS
          <span
            aria-label={recordingFieldHelp.fps}
            className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={recordingFieldHelp.fps}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <div className="join w-full">
          {recordingFpsOptions.map((fps) => (
            <button
              aria-pressed={selectedFps === fps}
              className={clsx(
                "btn join-item btn-sm min-w-0 flex-1",
                selectedFps === fps
                  ? "btn-primary"
                  : "btn-outline border-base-content/20 bg-base-200",
              )}
              data-fps={fps}
              disabled={isRecording || isBusy}
              key={fps}
              type="button"
              onClick={handleFpsSelect}
            >
              {fps} FPS
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          Video encoder
          <span
            aria-label={recordingFieldHelp.encoder}
            className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={recordingFieldHelp.encoder}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <select
          className="select select-bordered select-sm w-full"
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

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          <span className="inline-flex items-center gap-1">
            Recording quality
            <span
              aria-label={recordingFieldHelp.recordingQuality}
              className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
              data-tip={recordingFieldHelp.recordingQuality}
              role="img"
              tabIndex={0}
            >
              <FiInfo className="h-3.5 w-3.5" />
            </span>
          </span>
          <select
            className="select select-bordered select-sm w-full"
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

        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          <span className="inline-flex items-center gap-1">
            Clip quality
            <span
              aria-label={recordingFieldHelp.clipQuality}
              className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
              data-tip={recordingFieldHelp.clipQuality}
              role="img"
              tabIndex={0}
            >
              <FiInfo className="h-3.5 w-3.5" />
            </span>
          </span>
          <select
            className="select select-bordered select-sm w-full"
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
      </div>

      <ManagedRecorderOverlayCaptureToggle />
    </>
  );
}

export { ManagedRecorderSettingsFields };
