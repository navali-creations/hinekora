import type { ManagedRecorderStatus } from "~/types";

type CaptureMode = "session" | "rewind";
type RecorderReadinessTarget = "overlay" | "recording";

interface CaptureModeDisabledReasonInput {
  status: ManagedRecorderStatus | null;
  selectedMode: CaptureMode;
}

function createCapturePrimaryDisabledReason({
  status,
  selectedMode,
}: CaptureModeDisabledReasonInput): string | null {
  const readinessReason = createRecorderReadinessDisabledReason(
    status,
    "recording",
  );
  if (readinessReason || !status) {
    return readinessReason;
  }

  if (selectedMode === "session" && status.bufferActive) {
    return "Disable Rewind before starting a session recording.";
  }

  if (selectedMode === "rewind" && status.runRecordingActive) {
    return "Stop the session recording before enabling Rewind.";
  }

  return null;
}

function createRecorderOverlayDisabledReason(
  status: ManagedRecorderStatus | null,
): string | null {
  return createRecorderReadinessDisabledReason(status, "overlay");
}

function createRecorderReadinessDisabledReason(
  status: ManagedRecorderStatus | null,
  target: RecorderReadinessTarget,
): string | null {
  if (!status) {
    return "Recorder status is still loading.";
  }

  if (status.isStartingRecording) {
    return "Recording is starting. Wait for the current action to finish.";
  }

  if (status.isStoppingRecording) {
    return "Recording is stopping. Wait for the current action to finish.";
  }

  if (!status.available) {
    return status.error
      ? `Recorder is unavailable: ${status.error}`
      : "Recorder is unavailable. Check Capture Settings and restart Hinekora if the recorder failed to initialize.";
  }

  if (!status.gameRunning) {
    return target === "overlay"
      ? "Start the selected Path of Exile game before opening the recorder overlay."
      : "Start the selected Path of Exile game before recording.";
  }

  return null;
}

export type { CaptureMode };
export {
  createCapturePrimaryDisabledReason,
  createRecorderOverlayDisabledReason,
};
