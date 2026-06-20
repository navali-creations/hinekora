import { beforeEach, describe, expect, it, vi } from "vitest";

const processMocks = vi.hoisted(() => ({
  findRunningProcess: vi.fn(),
}));

vi.mock("../isProcessRunning", () => ({
  findRunningProcess: processMocks.findRunningProcess,
}));

import { ProcessPoller } from "../ProcessPoller";

class TestProcessPoller extends ProcessPoller {
  hasChanged(
    previous: { isRunning: boolean; processName: string } | undefined,
    current: { isRunning: boolean; processName: string },
  ): boolean {
    return this.hasStateChanged(previous, current);
  }
}

describe("ProcessPoller", () => {
  beforeEach(() => {
    processMocks.findRunningProcess.mockReset();
  });

  it("returns the first matching process state", async () => {
    processMocks.findRunningProcess.mockResolvedValue("PathOfExileSteam.exe");
    const poller = new ProcessPoller(["PathOfExileSteam.exe"], 5_000);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    expect(processMocks.findRunningProcess).toHaveBeenCalledWith([
      "PathOfExileSteam.exe",
    ]);
  });

  it("returns a stopped state when no process is running", async () => {
    processMocks.findRunningProcess.mockResolvedValue(null);
    const poller = new ProcessPoller(["PathOfExileSteam.exe"], 5_000);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("treats running state changes as active-state transitions", async () => {
    const poller = new ProcessPoller(["PathOfExileSteam.exe"], 5_000);
    const start = vi.fn();
    const stop = vi.fn();
    poller.on("start", start);
    poller.on("stop", stop);
    processMocks.findRunningProcess
      .mockResolvedValueOnce("PathOfExileSteam.exe")
      .mockResolvedValueOnce("PathOfExile.exe")
      .mockResolvedValueOnce(null);

    await poller.pollNow();
    await poller.pollNow();
    await poller.pollNow();

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("can require consecutive inactive polls before reporting stopped", async () => {
    const poller = new ProcessPoller(["PathOfExileSteam.exe"], 5_000, {
      inactivePollsBeforeStop: 2,
    });
    processMocks.findRunningProcess
      .mockResolvedValueOnce("PathOfExileSteam.exe")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("treats invalid inactive thresholds as one poll", async () => {
    const poller = new ProcessPoller(["PathOfExileSteam.exe"], 5_000, {
      inactivePollsBeforeStop: 0,
    });
    processMocks.findRunningProcess
      .mockResolvedValueOnce("PathOfExileSteam.exe")
      .mockResolvedValueOnce(null);

    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(poller.pollNow()).resolves.toEqual({
      isRunning: false,
      processName: "",
    });
  });

  it("compares previous and current process state fields", () => {
    const poller = new TestProcessPoller(["PathOfExileSteam.exe"], 5_000);

    expect(
      poller.hasChanged(undefined, { isRunning: false, processName: "" }),
    ).toBe(true);
    expect(
      poller.hasChanged(
        { isRunning: true, processName: "PathOfExileSteam.exe" },
        { isRunning: true, processName: "PathOfExileSteam.exe" },
      ),
    ).toBe(false);
    expect(
      poller.hasChanged(
        { isRunning: true, processName: "PathOfExileSteam.exe" },
        { isRunning: true, processName: "PathOfExile.exe" },
      ),
    ).toBe(true);
  });
});
