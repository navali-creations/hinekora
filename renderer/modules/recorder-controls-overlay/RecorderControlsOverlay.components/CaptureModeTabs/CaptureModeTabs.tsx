import type { ManagedRecorderCaptureMode } from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import { useManagedRecorderShallow } from "~/renderer/store";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";

function CaptureModeTabs() {
  const { captureMode, setCaptureMode, status } = useManagedRecorderShallow(
    (managedRecorder) => ({
      captureMode: managedRecorder.captureMode,
      setCaptureMode: managedRecorder.setCaptureMode,
      status: managedRecorder.status,
    }),
  );
  const isRewindActive = status?.bufferActive === true;
  const isRecordingActive = status?.runRecordingActive === true;

  const selectCaptureMode = (mode: ManagedRecorderCaptureMode) => {
    if (mode === captureMode) {
      return;
    }

    if (mode === "session" && isRewindActive) {
      return;
    }

    if (mode === "rewind" && isRecordingActive) {
      return;
    }

    void setCaptureMode(mode);
  };
  const handleRecording = () => {
    selectCaptureMode("session");
  };
  const handleRewind = () => {
    selectCaptureMode("rewind");
  };

  return (
    <div
      className={`${styles.modeTabs} flex shrink-0 items-center overflow-hidden`}
      role="tablist"
      aria-label="Recording mode"
    >
      <button
        aria-selected={captureMode === "session"}
        className={`${styles.modeTab} h-6 cursor-pointer border-0 bg-transparent px-2 text-[0.625rem] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-[0.45]`}
        disabled={isRewindActive}
        role="tab"
        type="button"
        onClick={handleRecording}
      >
        Recording
      </button>
      <button
        aria-selected={captureMode === "rewind"}
        className={`${styles.modeTab} h-6 cursor-pointer border-0 bg-transparent px-2 text-[0.625rem] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-[0.45]`}
        disabled={isRecordingActive}
        role="tab"
        type="button"
        onClick={handleRewind}
      >
        Rewind
      </button>
    </div>
  );
}

export { CaptureModeTabs };
