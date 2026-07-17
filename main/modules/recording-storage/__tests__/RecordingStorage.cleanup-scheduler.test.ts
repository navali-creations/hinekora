import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingStorageCleanupScheduler } from "../RecordingStorage.cleanup-scheduler";

function createScheduler(
  snapshot: { cachedUsageBytes: number | null; limitBytes: number } = {
    cachedUsageBytes: null,
    limitBytes: 100,
  },
) {
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const getSnapshot = vi.fn(() => snapshot);
  const handleError = vi.fn();
  const invalidateUsageCache = vi.fn();
  const scheduler = new RecordingStorageCleanupScheduler({
    cleanup,
    getSnapshot,
    handleError,
    invalidateUsageCache,
  });

  return {
    cleanup,
    getSnapshot,
    handleError,
    invalidateUsageCache,
    scheduler,
  };
}

describe("RecordingStorageCleanupScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces forced requests and protected paths", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();

    harness.scheduler.schedule({
      force: true,
      protectedDirectories: ["session-a"],
      protectedPaths: ["clip-a.mp4"],
    });
    harness.scheduler.schedule({
      protectedDirectories: ["session-b"],
      protectedPaths: ["clip-b.mp4"],
    });
    harness.scheduler.schedule();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.invalidateUsageCache).toHaveBeenCalledOnce();
    expect(harness.cleanup).toHaveBeenCalledWith({
      protectedDirectories: ["session-a", "session-b"],
      protectedPaths: ["clip-a.mp4", "clip-b.mp4"],
    });
  });

  it("does not scan without a usage cache or estimated growth", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();

    harness.scheduler.schedule();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).not.toHaveBeenCalled();
    expect(harness.invalidateUsageCache).not.toHaveBeenCalled();
  });

  it("does not scan while storage cleanup is disabled", async () => {
    vi.useFakeTimers();
    const harness = createScheduler({ cachedUsageBytes: 200, limitBytes: 0 });

    harness.scheduler.schedule({ force: true });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).not.toHaveBeenCalled();
  });

  it("runs when cached usage plus estimated growth exceeds the limit", async () => {
    vi.useFakeTimers();
    const harness = createScheduler({ cachedUsageBytes: 90, limitBytes: 100 });

    harness.scheduler.schedule({ estimatedAddedBytes: 11 });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("defers forced maintenance until performance-sensitive activity ends", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();
    harness.scheduler.setPerformanceSensitiveActivityActive(true);

    harness.scheduler.schedule({ force: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(harness.cleanup).not.toHaveBeenCalled();

    harness.scheduler.setPerformanceSensitiveActivityActive(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("cancels an already scheduled scan when sensitive activity begins", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();

    harness.scheduler.schedule({ force: true });
    harness.scheduler.setPerformanceSensitiveActivityActive(true);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(harness.cleanup).not.toHaveBeenCalled();
    harness.scheduler.setPerformanceSensitiveActivityActive(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("ignores repeated sensitive-activity state updates", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();

    harness.scheduler.setPerformanceSensitiveActivityActive(false);
    harness.scheduler.schedule({ force: true });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("allows over-limit cleanup during performance-sensitive activity", async () => {
    vi.useFakeTimers();
    const harness = createScheduler({ cachedUsageBytes: 90, limitBytes: 100 });
    harness.scheduler.setPerformanceSensitiveActivityActive(true);

    harness.scheduler.schedule({ estimatedAddedBytes: 11 });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("protects only the latest write after cleanup was deferred", async () => {
    vi.useFakeTimers();
    const snapshot = { cachedUsageBytes: 90, limitBytes: 100 };
    const harness = createScheduler(snapshot);
    harness.scheduler.setPerformanceSensitiveActivityActive(true);

    harness.scheduler.schedule({ protectedPaths: ["clip-a.mp4"] });
    harness.scheduler.schedule();
    snapshot.cachedUsageBytes = 101;
    harness.scheduler.schedule({ protectedPaths: ["clip-b.mp4"] });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).toHaveBeenCalledWith({
      protectedDirectories: [],
      protectedPaths: ["clip-b.mp4"],
    });
  });

  it("rechecks deferred cleanup when the first usage snapshot arrives", async () => {
    vi.useFakeTimers();
    const snapshot = {
      cachedUsageBytes: null as number | null,
      limitBytes: 100,
    };
    const harness = createScheduler(snapshot);
    harness.scheduler.setPerformanceSensitiveActivityActive(true);
    harness.scheduler.schedule({ estimatedAddedBytes: 11 });

    snapshot.cachedUsageBytes = 101;
    harness.scheduler.resetEstimatedUsageGrowth();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("resets estimated growth after a fresh usage scan", async () => {
    vi.useFakeTimers();
    const harness = createScheduler({ cachedUsageBytes: 90, limitBytes: 100 });

    harness.scheduler.schedule({ estimatedAddedBytes: 11 });
    harness.scheduler.resetEstimatedUsageGrowth();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).not.toHaveBeenCalled();
  });

  it("reports cleanup failures without an unhandled rejection", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();
    const error = new Error("cleanup failed");
    harness.cleanup.mockRejectedValueOnce(error);

    harness.scheduler.schedule({ force: true });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.handleError).toHaveBeenCalledWith(error);
  });

  it("abandons a queued callback if sensitive activity makes it deferrable", async () => {
    vi.useFakeTimers();
    const snapshot = { cachedUsageBytes: 101, limitBytes: 100 };
    const harness = createScheduler(snapshot);

    harness.scheduler.setPerformanceSensitiveActivityActive(true);
    harness.scheduler.schedule();
    snapshot.cachedUsageBytes = 90;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.cleanup).not.toHaveBeenCalled();
  });

  it("cancels pending work when disposed", async () => {
    vi.useFakeTimers();
    const harness = createScheduler();

    harness.scheduler.schedule({ force: true });
    harness.scheduler.dispose();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.getSnapshot).not.toHaveBeenCalled();
    expect(harness.cleanup).not.toHaveBeenCalled();
  });
});
