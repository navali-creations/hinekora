import { describe, expect, it, vi } from "vitest";

import * as appLog from "./app-log";
import { scheduleRecordingStorageInitialization } from "./recording-storage-startup";

describe("recording-storage-startup", () => {
  it("defers storage root initialization and unreferences the timer", () => {
    const initializeStorageRoot = vi.fn();
    const unref = vi.fn();
    let scheduledCallback: (() => void) | null = null;
    const schedule = vi.fn((callback: () => void, delayMs: number) => {
      scheduledCallback = callback;
      expect(delayMs).toBe(0);
      return { unref };
    });
    const logInfo = vi.spyOn(appLog, "logInfo").mockImplementation(() => {});

    scheduleRecordingStorageInitialization({ initializeStorageRoot }, schedule);

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
    expect(initializeStorageRoot).not.toHaveBeenCalled();

    const callback = scheduledCallback as (() => void) | null;
    if (!callback) {
      throw new Error("Expected deferred callback to be scheduled");
    }
    callback();

    expect(initializeStorageRoot).toHaveBeenCalledTimes(1);
    expect(logInfo).toHaveBeenCalledWith(
      "startup",
      "Recording storage initialized",
    );
  });

  it("logs deferred storage root initialization failures", () => {
    const initializeStorageRoot = vi.fn(() => {
      throw new Error("missing migration table");
    });
    let scheduledCallback: (() => void) | null = null;
    const schedule = vi.fn((callback: () => void) => {
      scheduledCallback = callback;
      return {};
    });
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});

    scheduleRecordingStorageInitialization({ initializeStorageRoot }, schedule);
    const callback = scheduledCallback as (() => void) | null;
    if (!callback) {
      throw new Error("Expected deferred callback to be scheduled");
    }
    callback();

    expect(logWarn).toHaveBeenCalledWith(
      "startup",
      "Recording storage initialization failed",
      { error: "missing migration table" },
    );
  });

  it("logs non-error deferred storage root initialization failures", () => {
    const nonErrorFailure = {
      toString: () => "storage unavailable",
    };
    const initializeStorageRoot = vi.fn(() => {
      throw nonErrorFailure;
    });
    let scheduledCallback: (() => void) | null = null;
    const schedule = vi.fn((callback: () => void) => {
      scheduledCallback = callback;
      return {};
    });
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});

    scheduleRecordingStorageInitialization({ initializeStorageRoot }, schedule);
    const callback = scheduledCallback as (() => void) | null;
    if (!callback) {
      throw new Error("Expected deferred callback to be scheduled");
    }
    callback();

    expect(logWarn).toHaveBeenCalledWith(
      "startup",
      "Recording storage initialization failed",
      { error: "storage unavailable" },
    );
  });
});
