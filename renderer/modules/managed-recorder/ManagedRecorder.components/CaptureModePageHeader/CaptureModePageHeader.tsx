import type { ReactNode } from "react";
import {
  FiInfo as Info,
  FiLoader as Loader2,
  FiPlay as Play,
  FiSquare as Square,
} from "react-icons/fi";

import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import {
  type TabsBoxItem,
  TabsBoxTabs,
} from "~/renderer/components/TabsBoxTabs/TabsBoxTabs";
import {
  useManagedRecorderShallow,
  useSettingsShallow,
} from "~/renderer/store";

import { maxRewindSaveSeconds, rewindBufferSeconds } from "~/types";
import {
  type CaptureMode,
  createCapturePrimaryDisabledReason,
} from "./CaptureModePageHeader.utils";

interface CaptureModePageHeaderProps {
  title: string;
  subtitle: ReactNode;
}

function CaptureModePageHeader({
  title,
  subtitle,
}: CaptureModePageHeaderProps) {
  const {
    captureMode: selectedMode,
    setCaptureMode,
    startBuffer,
    startRunRecording,
    status,
    stopBuffer,
    stopRunRecording,
  } = useManagedRecorderShallow((managedRecorder) => ({
    captureMode: managedRecorder.captureMode,
    setCaptureMode: managedRecorder.setCaptureMode,
    startBuffer: managedRecorder.startBuffer,
    startRunRecording: managedRecorder.startRunRecording,
    status: managedRecorder.status,
    stopBuffer: managedRecorder.stopBuffer,
    stopRunRecording: managedRecorder.stopRunRecording,
  }));
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const canRecord = status?.available === true && status.gameRunning === true;
  const isRewindActive = status?.bufferActive === true;
  const isSessionActive = status?.runRecordingActive === true;
  const isStarting = status?.isStartingRecording === true;
  const isStopping = status?.isStoppingRecording === true;
  const isBusy = isStarting || isStopping;
  const isSelectedSession = selectedMode === "session";
  const isSelectedRewind = selectedMode === "rewind";
  const isSelectedModeActive = isSelectedSession
    ? isSessionActive
    : isRewindActive;
  const primaryLabel = isSelectedSession
    ? isSessionActive
      ? "Stop & Save Recording"
      : "Start"
    : isRewindActive
      ? "Disable Rewind"
      : "Start";
  const primaryDisabled =
    !canRecord ||
    isBusy ||
    (isSelectedSession && isRewindActive) ||
    (isSelectedRewind && isSessionActive);
  const primaryDisabledReason = createCapturePrimaryDisabledReason({
    selectedMode,
    status,
  });
  const alertTitle = isSelectedSession
    ? "Session Recording selected."
    : "Rewind selected.";
  const alertCopy = isSelectedSession
    ? "Records everything from start to stop. Death clips and manual replays are off in this mode, but you can cut clips from the saved recording later."
    : `Keeps a ${rewindBufferSeconds} second buffer ready for death clips or manual replays. Saved rewinds use your configured duration, up to ${maxRewindSaveSeconds} seconds.`;
  const isAlertDismissed =
    settingsValue?.captureModeInfoAlertDismissed === true;

  const handleCaptureModeChange = (mode: CaptureMode) => {
    if (mode === "session" && isRewindActive) {
      return;
    }

    if (mode === "rewind" && isSessionActive) {
      return;
    }

    void setCaptureMode(mode);
  };

  const handlePrimaryAction = () => {
    if (isSelectedSession) {
      void (isSessionActive ? stopRunRecording() : startRunRecording());
      return;
    }

    void (isRewindActive ? stopBuffer() : startBuffer());
  };

  const handleDismissAlert = () => {
    void updateSettings({
      captureModeInfoAlertDismissed: true,
    });
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              aria-label="Capture mode"
              className="tabs tabs-box tabs-sm min-w-0 flex-auto bg-base-200"
              data-onboarding="capture-mode"
              role="tablist"
            >
              <TabsBoxTabs
                items={
                  [
                    {
                      value: "session",
                      label: "Session Recording",
                      disabled: isRewindActive,
                    },
                    {
                      value: "rewind",
                      label: "Rewind",
                      disabled: isSessionActive,
                    },
                  ] satisfies TabsBoxItem<CaptureMode>[]
                }
                size="sm"
                value={selectedMode}
                onChange={handleCaptureModeChange}
              />
            </div>

            <div
              className="tooltip tooltip-left no-drag"
              data-tip={primaryDisabled ? primaryDisabledReason : ""}
              data-onboarding="start-recording"
            >
              <button
                className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={primaryDisabled}
                onClick={handlePrimaryAction}
              >
                {isBusy ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : isSelectedModeActive ? (
                  <Square size={16} />
                ) : (
                  <Play size={16} />
                )}
                {primaryLabel}
              </button>
            </div>
          </div>
        }
      />

      {!isAlertDismissed && (
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-info bg-secondary px-4 py-3 text-[0.8125rem] text-info leading-relaxed shadow-sm"
          role="status"
        >
          <Info size={18} />
          <p className="m-0">
            <strong className="block">{alertTitle}</strong>
            <span className="block">{alertCopy}</span>
          </p>
          <button
            aria-label="Dismiss capture mode info"
            className="btn btn-xs border-info/20 bg-base-300/80 px-2 text-info hover:bg-base-300"
            title="Dismiss"
            type="button"
            onClick={handleDismissAlert}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

export { CaptureModePageHeader };
