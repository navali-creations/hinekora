import type { RecordingStorageRetentionOptions } from "./RecordingStorage.retention";

const storageCleanupScheduleDelayMs = 1_000;

type RecordingStorageCleanupOptions = RecordingStorageRetentionOptions;

interface RecordingStorageCleanupSchedule
  extends RecordingStorageCleanupOptions {
  estimatedAddedBytes?: number;
  force?: boolean;
  usageAlreadyAccounted?: boolean;
}

interface RecordingStorageCleanupSchedulerSnapshot {
  cachedUsageBytes: number | null;
  limitBytes: number;
}

interface RecordingStorageCleanupSchedulerDependencies {
  cleanup: (options: RecordingStorageCleanupOptions) => Promise<unknown>;
  getSnapshot: () => RecordingStorageCleanupSchedulerSnapshot;
  handleError: (error: unknown) => void;
  invalidateUsageCache: () => void;
}

class RecordingStorageCleanupScheduler {
  private estimatedUsageGrowthBytesSinceScan = 0;
  private performanceSensitiveActivityActive = false;
  private pendingCleanup: {
    force: boolean;
    protectedDirectories: Set<string>;
    protectedPaths: Set<string>;
  } | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dependencies: RecordingStorageCleanupSchedulerDependencies,
  ) {}

  schedule(schedule: RecordingStorageCleanupSchedule = {}): void {
    this.estimatedUsageGrowthBytesSinceScan += Math.max(
      0,
      schedule.estimatedAddedBytes ?? 0,
    );
    if (
      this.pendingCleanup &&
      this.performanceSensitiveActivityActive &&
      this.timer === null
    ) {
      this.pendingCleanup.force ||= schedule.force === true;
      this.pendingCleanup.protectedDirectories = new Set(
        schedule.protectedDirectories ?? [],
      );
      this.pendingCleanup.protectedPaths = new Set(
        schedule.protectedPaths ?? [],
      );
    } else if (this.pendingCleanup) {
      this.pendingCleanup.force ||= schedule.force === true;
      for (const path of schedule.protectedDirectories ?? []) {
        this.pendingCleanup.protectedDirectories.add(path);
      }
      for (const path of schedule.protectedPaths ?? []) {
        this.pendingCleanup.protectedPaths.add(path);
      }
    } else {
      this.pendingCleanup = {
        force: schedule.force === true,
        protectedDirectories: new Set(schedule.protectedDirectories ?? []),
        protectedPaths: new Set(schedule.protectedPaths ?? []),
      };
    }

    this.schedulePendingCleanup();
  }

  setPerformanceSensitiveActivityActive(active: boolean): void {
    if (this.performanceSensitiveActivityActive === active) {
      return;
    }
    this.performanceSensitiveActivityActive = active;
    if (active && this.shouldDeferPendingCleanup()) {
      this.clearTimer();
      return;
    }
    this.schedulePendingCleanup();
  }

  resetEstimatedUsageGrowth(): void {
    this.estimatedUsageGrowthBytesSinceScan = 0;
    this.schedulePendingCleanup();
  }

  dispose(): void {
    this.clearTimer();
    this.pendingCleanup = null;
  }

  private schedulePendingCleanup(): void {
    if (
      !this.pendingCleanup ||
      this.timer ||
      this.shouldDeferPendingCleanup()
    ) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runPendingCleanup();
    }, storageCleanupScheduleDelayMs);
    this.timer.unref?.();
  }

  private shouldDeferPendingCleanup(): boolean {
    if (!this.performanceSensitiveActivityActive || !this.pendingCleanup) {
      return false;
    }
    const { cachedUsageBytes, limitBytes } = this.dependencies.getSnapshot();
    return (
      limitBytes <= 0 ||
      cachedUsageBytes === null ||
      cachedUsageBytes + this.estimatedUsageGrowthBytesSinceScan <= limitBytes
    );
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = null;
  }

  private async runPendingCleanup(): Promise<void> {
    const pending = this.pendingCleanup;
    if (!pending || this.shouldDeferPendingCleanup()) {
      return;
    }
    this.pendingCleanup = null;

    try {
      const { cachedUsageBytes, limitBytes } = this.dependencies.getSnapshot();
      if (limitBytes <= 0) {
        return;
      }
      if (
        pending.force !== true &&
        cachedUsageBytes !== null &&
        cachedUsageBytes + this.estimatedUsageGrowthBytesSinceScan <= limitBytes
      ) {
        return;
      }
      if (
        pending.force !== true &&
        cachedUsageBytes === null &&
        this.estimatedUsageGrowthBytesSinceScan <= 0
      ) {
        return;
      }

      this.dependencies.invalidateUsageCache();
      await this.dependencies.cleanup({
        protectedDirectories: [...pending.protectedDirectories],
        protectedPaths: [...pending.protectedPaths],
      });
    } catch (error) {
      this.dependencies.handleError(error);
    }
  }
}

export {
  type RecordingStorageCleanupOptions,
  type RecordingStorageCleanupSchedule,
  RecordingStorageCleanupScheduler,
};
