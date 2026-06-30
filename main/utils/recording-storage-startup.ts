import * as appLog from "./app-log";

interface RecordingStorageStartupService {
  initializeStorageRoot: () => void;
}

interface DeferredStartupTimer {
  unref?: () => void;
}

type DeferredStartupScheduler = (
  callback: () => void,
  delayMs: number,
) => DeferredStartupTimer;

function scheduleRecordingStorageInitialization(
  recordingStorage: RecordingStorageStartupService,
  schedule: DeferredStartupScheduler = setTimeout,
): DeferredStartupTimer {
  const timer = schedule(() => {
    try {
      recordingStorage.initializeStorageRoot();
      appLog.logInfo("startup", "Recording storage initialized");
    } catch (error) {
      appLog.logWarn("startup", "Recording storage initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 0);
  timer.unref?.();

  return timer;
}

export type { DeferredStartupScheduler, DeferredStartupTimer };
export { scheduleRecordingStorageInitialization };
