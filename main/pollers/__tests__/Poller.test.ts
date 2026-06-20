import { afterEach, describe, expect, it, vi } from "vitest";

import { Poller } from "../Poller";

class TestPoller extends Poller<boolean> {
  readonly onStartHook = vi.fn();
  readonly onStopHook = vi.fn();
  readonly onDataHook = vi.fn();
  queue: Array<boolean | Error> = [];

  constructor() {
    super(100);
  }

  protected async pollOnce(): Promise<boolean> {
    const next = this.queue.shift() ?? false;
    if (next instanceof Error) {
      throw next;
    }

    return next;
  }

  protected isStateActive(state: boolean): boolean {
    return state;
  }

  protected override onStart(state: boolean): void {
    this.onStartHook(state);
  }

  protected override onStop(previousState: boolean): void {
    this.onStopHook(previousState);
  }

  protected override onData(state: boolean): void {
    this.onDataHook(state);
  }
}

describe("Poller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits data, start, and stop transitions", async () => {
    const poller = new TestPoller();
    const data = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    poller.on("data", data);
    poller.on("start", start);
    poller.on("stop", stop);
    poller.queue.push(false, true, true, false);

    await expect(poller.pollNow()).resolves.toBe(false);
    await expect(poller.pollNow()).resolves.toBe(true);
    await expect(poller.pollNow()).resolves.toBe(true);
    await expect(poller.pollNow()).resolves.toBe(false);

    expect(data).toHaveBeenCalledTimes(4);
    expect(start).toHaveBeenCalledWith(true);
    expect(stop).toHaveBeenCalledWith(true);
    expect(poller.onDataHook).toHaveBeenCalledTimes(4);
    expect(poller.onStartHook).toHaveBeenCalledWith(true);
    expect(poller.onStopHook).toHaveBeenCalledWith(true);
  });

  it("starts, ignores duplicate starts, and stops the interval", async () => {
    vi.useFakeTimers();
    const poller = new TestPoller();
    poller.queue.push(false, true);

    poller.start();
    poller.start();
    expect(poller.isPollerRunning).toBe(true);
    await vi.runOnlyPendingTimersAsync();

    poller.stop();
    poller.stop();
    expect(poller.isPollerRunning).toBe(false);
  });

  it("emits scheduled poll errors without unhandled rejections", async () => {
    vi.useFakeTimers();
    const poller = new TestPoller();
    const error = new Error("scheduled failure");
    const errorListener = vi.fn();
    poller.on("error", errorListener);
    poller.queue.push(error);

    poller.start();
    await vi.runOnlyPendingTimersAsync();
    poller.stop();

    expect(errorListener).toHaveBeenCalledWith(error);
  });

  it("shares in-flight polls and emits errors", async () => {
    const poller = new TestPoller();
    const error = new Error("failed");
    const errorListener = vi.fn();
    poller.on("error", errorListener);
    poller.queue.push(error);

    const first = poller.pollNow();
    const second = poller.pollNow();

    await expect(first).rejects.toThrow("failed");
    await expect(second).rejects.toThrow("failed");
    expect(errorListener).toHaveBeenCalledWith(error);
  });

  it("handles a defensive inactive transition without previous state", async () => {
    const poller = new TestPoller();
    const internals = poller as unknown as {
      active: boolean;
      previousState: boolean | undefined;
    };
    internals.active = true;
    internals.previousState = undefined;
    poller.queue.push(false);

    await expect(poller.pollNow()).resolves.toBe(false);

    expect(poller.onStopHook).not.toHaveBeenCalled();
  });
});
