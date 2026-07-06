import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PoeProcessError,
  PoeProcessSnapshot,
} from "~/main/modules/poe-process/PoeProcess.dto";
import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
} from "~/main/modules/poe-process/PoeProcess.dto";
import {
  createPoeProcessSnapshotFromState,
  createRunningPoeProcessState,
} from "~/main/test/poe-process";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createPoeProcessSlice } from "./PoeProcess.slice";

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      ({
        ...createPoeProcessSlice(set, get, api),
        capturePreview: {
          error: null,
          hydrate: vi.fn(),
          isLoading: false,
          refresh: vi.fn(),
          select: vi.fn(),
          selectedSourceId: null,
          sources: [],
          startListening: vi.fn(),
        },
      }) as unknown as BoundStore,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("PoeProcess slice", () => {
  const listeners: {
    start?: (state: PoeProcessSnapshot) => void;
    stop?: (state: PoeProcessSnapshot) => void;
    state?: (state: PoeProcessSnapshot) => void;
    error?: (error: PoeProcessError) => void;
  } = {};
  const unsubscribers = {
    start: vi.fn(),
    stop: vi.fn(),
    state: vi.fn(),
    error: vi.fn(),
  };
  const getSnapshot = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(listeners)) {
      delete listeners[key as keyof typeof listeners];
    }

    getSnapshot.mockResolvedValue(
      createPoeProcessSnapshotFromState(createRunningPoeProcessState("poe2")),
    );

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        poeProcess: {
          getSnapshot,
          onStart: vi.fn((listener: (state: PoeProcessSnapshot) => void) => {
            listeners.start = listener;
            return unsubscribers.start;
          }),
          onStop: vi.fn((listener: (state: PoeProcessSnapshot) => void) => {
            listeners.stop = listener;
            return unsubscribers.stop;
          }),
          onSnapshot: vi.fn((listener: (state: PoeProcessSnapshot) => void) => {
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

    expect(store.getState().poeProcess.state).toEqual(
      createRunningPoeProcessState("poe2"),
    );
    expect(store.getState().poeProcess.states.poe2).toEqual(
      createRunningPoeProcessState("poe2"),
    );
  });

  it("updates process state from main events", () => {
    const store = createTestStore();
    const unsubscribe = store.getState().poeProcess.startListening();

    listeners.state?.(
      createPoeProcessSnapshotFromState(createRunningPoeProcessState("poe2")),
    );
    expect(store.getState().poeProcess.state).toEqual(
      createRunningPoeProcessState("poe2"),
    );

    listeners.state?.(
      createPoeProcessSnapshotFromState(createRunningPoeProcessState("poe2")),
    );

    listeners.state?.(
      createPoeProcessSnapshotFromState(createRunningPoeProcessState("poe1")),
    );
    expect(store.getState().poeProcess.state).toEqual(
      createRunningPoeProcessState("poe1"),
    );

    listeners.stop?.(createPoeProcessSnapshot(createStoppedPoeProcessStates()));
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

  it("does not let a late hydrate overwrite process change events", async () => {
    const hydrate = createDeferred<PoeProcessSnapshot>();
    getSnapshot.mockReturnValueOnce(hydrate.promise);
    const store = createTestStore();
    store.getState().poeProcess.startListening();

    const hydrateRequest = store.getState().poeProcess.hydrate();
    listeners.state?.(
      createPoeProcessSnapshotFromState(createRunningPoeProcessState("poe2")),
    );
    hydrate.resolve(createPoeProcessSnapshot(createStoppedPoeProcessStates()));
    await hydrateRequest;

    expect(store.getState().poeProcess.state).toEqual(
      createRunningPoeProcessState("poe2"),
    );
  });
});
