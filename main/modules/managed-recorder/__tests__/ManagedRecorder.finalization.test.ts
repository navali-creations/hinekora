import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunRecordingCreateInput } from "~/main/modules/recording-storage";
import * as AppLog from "~/main/utils/app-log";

import { RunRecordingFinalizationCoordinator } from "../ManagedRecorder.finalization";

function createInput(): RunRecordingCreateInput {
  return {
    framesPerSecond: 60,
    path: "C:\\Recordings\\2026-09-05_10-00-00.mp4",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    startedAt: "2026-09-05T10:00:00.000Z",
    stoppedAt: "2026-09-05T11:00:00.000Z",
  };
}

function createHarness() {
  let error: string | null = null;
  const dependencies = {
    cleanup: vi.fn(),
    finalize: vi.fn(),
    getError: vi.fn(() => error),
    isRetryDeferred: vi.fn(() => false),
    isValid: vi.fn(() => true),
    setError: vi.fn((nextError: string | null) => {
      error = nextError;
    }),
    store: {
      clear: vi.fn(),
      load: vi.fn<() => RunRecordingCreateInput | null>(() => null),
      save: vi.fn(),
    },
  };

  return {
    coordinator: new RunRecordingFinalizationCoordinator(dependencies),
    dependencies,
    setCurrentError: (nextError: string | null) => {
      error = nextError;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RunRecordingFinalizationCoordinator", () => {
  it("is a no-op when no finalization is pending", () => {
    const { coordinator, dependencies } = createHarness();

    coordinator.finalizeStaged();
    coordinator.restore();

    expect(coordinator.retry()).toBe(true);
    expect(coordinator.flush()).toBe(true);
    expect(dependencies.finalize).not.toHaveBeenCalled();
    expect(dependencies.store.load).toHaveBeenCalledOnce();
  });

  it("finalizes staged metadata and clears its durable marker", () => {
    const { coordinator, dependencies } = createHarness();
    const input = createInput();

    coordinator.stage(input);
    coordinator.finalizeStaged();

    expect(dependencies.store.save).toHaveBeenCalledWith(input);
    expect(dependencies.finalize).toHaveBeenCalledWith(input, false);
    expect(dependencies.store.clear).toHaveBeenCalledOnce();
  });

  it("persists a queued retry, recovers it, and clears its matching error", () => {
    vi.useFakeTimers();
    const { coordinator, dependencies, setCurrentError } = createHarness();
    const input = createInput();
    setCurrentError("database unavailable");

    coordinator.queue(input, "database unavailable");
    coordinator.queue(input, "database unavailable");
    expect(coordinator.retry()).toBe(true);

    expect(dependencies.store.save).toHaveBeenCalledOnce();
    expect(dependencies.finalize).toHaveBeenCalledWith(input, true);
    expect(dependencies.setError).toHaveBeenCalledWith(null);
    expect(dependencies.cleanup).toHaveBeenCalledWith(input.path);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries persistence failures without hiding the recovery warning", () => {
    vi.useFakeTimers();
    const { coordinator, dependencies, setCurrentError } = createHarness();
    const input = createInput();
    const persistenceError = new Error("recovery drive unavailable");
    dependencies.store.save
      .mockImplementationOnce(() => {
        throw persistenceError;
      })
      .mockImplementationOnce(() => undefined);
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    setCurrentError("newer error");

    coordinator.queue(input, "database unavailable");
    expect(coordinator.retry()).toBe(true);

    expect(logWarn).toHaveBeenCalledWith(
      "managed-recorder",
      "Run recording finalization recovery could not be persisted",
      expect.objectContaining({ error: persistenceError.message }),
    );
    expect(dependencies.store.save).toHaveBeenCalledTimes(2);
    expect(dependencies.setError).not.toHaveBeenCalledWith(null);
  });

  it("keeps failed recovery pending and flushes without scheduling again", async () => {
    vi.useFakeTimers();
    const { coordinator, dependencies } = createHarness();
    const input = createInput();
    dependencies.finalize.mockImplementation(() => {
      throw new Error("database unavailable");
    });

    coordinator.stage(input);
    expect(() => coordinator.finalizeStaged()).toThrow("database unavailable");
    coordinator.queue(input, "database unavailable");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(dependencies.setError).toHaveBeenCalledWith("database unavailable");
    expect(vi.getTimerCount()).toBe(1);
    expect(coordinator.flush()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restores durable metadata and retries it on the timer", async () => {
    vi.useFakeTimers();
    const { coordinator, dependencies } = createHarness();
    const input = createInput();
    dependencies.store.load.mockReturnValue(input);

    coordinator.restore();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(dependencies.finalize).toHaveBeenCalledWith(input, true);
    expect(dependencies.store.clear).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("defers automatic retries while performance-sensitive activity is active", async () => {
    vi.useFakeTimers();
    const { coordinator, dependencies } = createHarness();
    const input = createInput();
    dependencies.isRetryDeferred.mockReturnValue(true);

    coordinator.queue(input, "database unavailable");
    await vi.advanceTimersByTimeAsync(30_000);

    expect(dependencies.finalize).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    dependencies.isRetryDeferred.mockReturnValue(false);
    expect(coordinator.retry()).toBe(true);
    expect(dependencies.finalize).toHaveBeenCalledWith(input, true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])(
    "discards invalid durable metadata when clear throws: %s",
    (clearThrows) => {
      const { coordinator, dependencies } = createHarness();
      dependencies.store.load.mockImplementation(() => {
        throw new Error("invalid recovery");
      });
      if (clearThrows) {
        dependencies.store.clear.mockImplementation(() => {
          throw new Error("recovery file is locked");
        });
      }
      const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});

      coordinator.restore();

      expect(logWarn).toHaveBeenCalledWith(
        "managed-recorder",
        "Invalid run recording finalization recovery was discarded",
        { error: "invalid recovery" },
      );
      if (clearThrows) {
        expect(logWarn).toHaveBeenCalledWith(
          "managed-recorder",
          "Invalid run recording finalization recovery could not be removed",
          { error: "recovery file is locked" },
        );
      }
    },
  );

  it("discards recovery metadata that references unmanaged storage", () => {
    const { coordinator, dependencies } = createHarness();
    dependencies.store.load.mockReturnValue(createInput());
    dependencies.isValid.mockReturnValue(false);
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});

    coordinator.restore();

    expect(dependencies.store.clear).toHaveBeenCalledOnce();
    expect(logWarn).toHaveBeenCalledWith(
      "managed-recorder",
      "Invalid run recording finalization recovery was discarded",
      {
        error:
          "Run recording recovery metadata is invalid or references unmanaged storage",
      },
    );
  });

  it("rejects invalid metadata before staging it", () => {
    const { coordinator, dependencies } = createHarness();
    const input = createInput();
    dependencies.isValid.mockReturnValue(false);

    expect(() => coordinator.stage(input)).toThrow(
      "Run recording recovery metadata is invalid or references unmanaged storage",
    );
    expect(dependencies.store.save).not.toHaveBeenCalled();
    expect(dependencies.finalize).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "discards invalid queued metadata without retrying when clear throws: %s",
    (clearThrows) => {
      vi.useFakeTimers();
      const { coordinator, dependencies } = createHarness();
      const input = createInput();
      dependencies.isValid.mockReturnValue(false);
      if (clearThrows) {
        dependencies.store.clear.mockImplementation(() => {
          throw new Error("recovery file is locked");
        });
      }
      const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});

      coordinator.queue(input, "invalid metadata");

      expect(dependencies.setError).toHaveBeenCalledWith(
        "Run recording recovery metadata is invalid or references unmanaged storage",
      );
      expect(dependencies.store.clear).toHaveBeenCalledOnce();
      expect(dependencies.store.save).not.toHaveBeenCalled();
      expect(dependencies.finalize).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(coordinator.retry()).toBe(true);
      expect(logWarn).toHaveBeenCalledWith(
        "managed-recorder",
        "Invalid run recording finalization was not retried",
        expect.objectContaining({ recordingHash: expect.any(String) }),
      );
      if (clearThrows) {
        expect(logWarn).toHaveBeenCalledWith(
          "managed-recorder",
          "Invalid run recording finalization recovery could not be removed",
          { error: "recovery file is locked" },
        );
      }
    },
  );

  it("discards staged metadata if it becomes invalid before retry", () => {
    vi.useFakeTimers();
    const { coordinator, dependencies } = createHarness();
    const input = createInput();

    coordinator.stage(input);
    coordinator.queue(input, "database unavailable");
    dependencies.isValid.mockReturnValue(false);

    expect(coordinator.retry()).toBe(true);
    expect(dependencies.store.clear).toHaveBeenCalledOnce();
    expect(dependencies.finalize).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
