import type { RunRecordingCreateInput } from "~/main/modules/recording-storage";
import {
  createSafePathLogFields,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

const MANAGED_RECORDER_LOG_SCOPE = "managed-recorder";
const RUN_RECORDING_FINALIZATION_RETRY_BASE_MS = 1_000;
const RUN_RECORDING_FINALIZATION_RETRY_MAX_MS = 30_000;
const invalidRunRecordingFinalizationMessage =
  "Run recording recovery metadata is invalid or references unmanaged storage";

interface PendingRunRecordingFinalization {
  failureMessage: string;
  input: RunRecordingCreateInput;
}

interface RunRecordingFinalizationCoordinatorDependencies {
  cleanup(path: string): void;
  finalize(input: RunRecordingCreateInput, recovered: boolean): void;
  getError(): string | null;
  isRetryDeferred(): boolean;
  isValid(input: RunRecordingCreateInput): boolean;
  setError(error: string | null): void;
  store: {
    clear(): void;
    load(): RunRecordingCreateInput | null;
    save(input: RunRecordingCreateInput): void;
  };
}

class RunRecordingFinalizationCoordinator {
  private pending: PendingRunRecordingFinalization | null = null;
  private persisted = false;
  private retryAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly dependencies: RunRecordingFinalizationCoordinatorDependencies,
  ) {}

  stage(input: RunRecordingCreateInput): void {
    if (!this.dependencies.isValid(input)) {
      throw new Error(invalidRunRecordingFinalizationMessage);
    }
    this.pending = { failureMessage: "", input };
    this.persisted = false;
    this.dependencies.store.save(input);
    this.persisted = true;
  }

  finalizeStaged(): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }

    this.dependencies.finalize(pending.input, false);
    this.clear();
  }

  queue(input: RunRecordingCreateInput, failureMessage: string): void {
    if (!this.dependencies.isValid(input)) {
      this.discardInvalid(input);
      return;
    }
    this.pending = { failureMessage, input };
    if (!this.persisted) {
      try {
        this.dependencies.store.save(input);
        this.persisted = true;
      } catch (error) {
        logWarn(
          MANAGED_RECORDER_LOG_SCOPE,
          "Run recording finalization recovery could not be persisted",
          {
            error: safeErrorMessage(error),
            ...createSafePathLogFields(input.path, "recording"),
          },
        );
      }
    }
    this.retryAttempt = 0;
    this.scheduleRetry();
  }

  retry(scheduleOnFailure = true): boolean {
    this.clearRetryTimer();
    const pending = this.pending;
    if (!pending) {
      return true;
    }
    if (!this.dependencies.isValid(pending.input)) {
      this.discardInvalid(pending.input);
      return true;
    }

    try {
      if (!this.persisted) {
        this.dependencies.store.save(pending.input);
        this.persisted = true;
      }
      this.dependencies.finalize(pending.input, true);
      this.clear();
      if (this.dependencies.getError() === pending.failureMessage) {
        this.dependencies.setError(null);
      }
      this.dependencies.cleanup(pending.input.path);
      logInfo(
        MANAGED_RECORDER_LOG_SCOPE,
        "Run recording finalization recovered",
        createSafePathLogFields(pending.input.path, "recording"),
      );
      return true;
    } catch (error) {
      const message = safeErrorMessage(error);
      pending.failureMessage = message;
      this.dependencies.setError(message);
      this.retryAttempt += 1;
      if (scheduleOnFailure) {
        this.scheduleRetry();
      }
      logWarn(
        MANAGED_RECORDER_LOG_SCOPE,
        "Run recording finalization retry failed",
        {
          error: message,
          ...createSafePathLogFields(pending.input.path, "recording"),
        },
      );
      return false;
    }
  }

  flush(): boolean {
    return this.retry(false);
  }

  restore(): void {
    try {
      const input = this.dependencies.store.load();
      if (!input) {
        return;
      }
      if (!this.dependencies.isValid(input)) {
        throw new Error(invalidRunRecordingFinalizationMessage);
      }

      this.pending = {
        failureMessage: "Run recording finalization is pending",
        input,
      };
      this.persisted = true;
      this.scheduleRetry();
      logInfo(
        MANAGED_RECORDER_LOG_SCOPE,
        "Pending run recording finalization restored",
        createSafePathLogFields(input.path, "recording"),
      );
    } catch (error) {
      logWarn(
        MANAGED_RECORDER_LOG_SCOPE,
        "Invalid run recording finalization recovery was discarded",
        { error: safeErrorMessage(error) },
      );
      try {
        this.dependencies.store.clear();
      } catch (clearError) {
        logWarn(
          MANAGED_RECORDER_LOG_SCOPE,
          "Invalid run recording finalization recovery could not be removed",
          { error: safeErrorMessage(clearError) },
        );
      }
    }
  }

  private scheduleRetry(): void {
    if (!this.pending || this.retryTimer) {
      return;
    }

    const retryDelayMs = this.dependencies.isRetryDeferred()
      ? RUN_RECORDING_FINALIZATION_RETRY_MAX_MS
      : Math.min(
          RUN_RECORDING_FINALIZATION_RETRY_BASE_MS *
            2 ** Math.min(this.retryAttempt, 5),
          RUN_RECORDING_FINALIZATION_RETRY_MAX_MS,
        );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.dependencies.isRetryDeferred()) {
        this.scheduleRetry();
        return;
      }
      this.retry();
    }, retryDelayMs);
    this.retryTimer.unref?.();
  }

  private discardInvalid(input: RunRecordingCreateInput): void {
    this.pending = null;
    this.persisted = false;
    this.retryAttempt = 0;
    this.clearRetryTimer();
    this.dependencies.setError(invalidRunRecordingFinalizationMessage);
    try {
      this.dependencies.store.clear();
    } catch (error) {
      logWarn(
        MANAGED_RECORDER_LOG_SCOPE,
        "Invalid run recording finalization recovery could not be removed",
        { error: safeErrorMessage(error) },
      );
    }
    logWarn(
      MANAGED_RECORDER_LOG_SCOPE,
      "Invalid run recording finalization was not retried",
      createSafePathLogFields(input.path, "recording"),
    );
  }

  private clear(): void {
    this.dependencies.store.clear();
    this.pending = null;
    this.persisted = false;
    this.retryAttempt = 0;
    this.clearRetryTimer();
  }

  private clearRetryTimer(): void {
    if (!this.retryTimer) {
      return;
    }

    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}

export { RunRecordingFinalizationCoordinator };
