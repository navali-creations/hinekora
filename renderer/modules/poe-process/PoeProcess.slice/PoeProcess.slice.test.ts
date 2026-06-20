import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PoeProcessError,
  PoeProcessState,
} from "~/main/modules/poe-process/PoeProcess.dto";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createPoeProcessSlice } from "./PoeProcess.slice";

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createPoeProcessSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("PoeProcess slice", () => {
  const listeners: {
    start?: (state: PoeProcessState) => void;
    stop?: (state: PoeProcessState) => void;
    state?: (state: PoeProcessState) => void;
    error?: (error: PoeProcessError) => void;
  } = {};
  const unsubscribers = {
    start: vi.fn(),
    stop: vi.fn(),
    state: vi.fn(),
    error: vi.fn(),
  };
  const getState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(listeners)) {
      delete listeners[key as keyof typeof listeners];
    }

    getState.mockResolvedValue({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        poeProcess: {
          getState,
          onStart: vi.fn((listener: (state: PoeProcessState) => void) => {
            listeners.start = listener;
            return unsubscribers.start;
          }),
          onStop: vi.fn((listener: (state: PoeProcessState) => void) => {
            listeners.stop = listener;
            return unsubscribers.stop;
          }),
          onState: vi.fn((listener: (state: PoeProcessState) => void) => {
            listeners.state = listener;
            return unsubscribers.state;
          }),
          onError: vi.fn((listener: (error: PoeProcessError) => void) => {
            listeners.error = listener;
            return unsubscribers.error;
          }),
        },
      },
    });
  });

  it("hydrates the current process state", async () => {
    const store = createTestStore();

    await store.getState().poeProcess.hydrate();

    expect(store.getState().poeProcess.state).toEqual({
      isRunning: true,
      processName: "PathOfExile2Steam.exe",
    });
  });

  it("listens for process state and error updates", () => {
    const store = createTestStore();
    const unsubscribe = store.getState().poeProcess.startListening();

    listeners.state?.({
      isRunning: false,
      processName: "",
    });
    expect(store.getState().poeProcess.state).toEqual({
      isRunning: false,
      processName: "",
    });

    listeners.error?.({ error: "process failed" });
    expect(store.getState().poeProcess.error).toBe("process failed");

    unsubscribe();
    expect(unsubscribers.start).toHaveBeenCalled();
    expect(unsubscribers.stop).toHaveBeenCalled();
    expect(unsubscribers.state).toHaveBeenCalled();
    expect(unsubscribers.error).toHaveBeenCalled();
  });
});
