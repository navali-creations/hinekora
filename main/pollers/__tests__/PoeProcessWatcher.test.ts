import type { spawn } from "node:child_process";
import EventEmitter from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  getPoeProcessStateForGame,
  type PoeProcessState,
} from "~/main/modules/poe-process/PoeProcess.dto";

import type { GameId } from "~/types";
import { resolveWindowsPoeProcessHelperPath } from "../PoeProcessHelperPath";
import {
  createHelperExitMessage,
  normalizeHelperProcessStates,
} from "../PoeProcessHelperProtocol";
import { PoeProcessWatcher } from "../PoeProcessWatcher";

type SpawnResult = ReturnType<typeof spawn>;
type SpawnMockCall = [string, string[], unknown];
type HelperStateInput = {
  game: GameId;
  isRunning: boolean;
  pid?: number;
  processName?: string;
  windowTitle?: string;
};

const helperPath = "C:\\Hinekora\\hinekora-poe-process-helper.exe";
const helperDefaultsByGame: Record<
  GameId,
  { pid: number; processName: string; windowTitle: string }
> = {
  poe1: {
    pid: 10_001,
    processName: "PathOfExile.exe",
    windowTitle: "Path of Exile",
  },
  poe2: {
    pid: 20_002,
    processName: "PathOfExileSteam.exe",
    windowTitle: "Path of Exile 2",
  },
};

class FakeWatcherChild extends EventEmitter {
  readonly stderr = new PassThrough();
  readonly stdout = new PassThrough();
  readonly kill = vi.fn(() => {
    this.emit("exit", 0, null);
    return true;
  });
}

class LazyExitFakeWatcherChild extends FakeWatcherChild {
  override readonly kill = vi.fn(() => true);
}

function createSpawnMock(child: FakeWatcherChild) {
  return vi.fn(() => child as unknown as SpawnResult);
}

function createSpawnSequenceMock(children: FakeWatcherChild[]) {
  let childIndex = 0;

  return vi.fn(() => {
    const child = children[childIndex];
    childIndex += 1;
    if (!child) {
      throw new Error("No fake helper child configured");
    }

    return child as unknown as SpawnResult;
  });
}

function createStoppedHelperStates(): HelperStateInput[] {
  return [
    { game: "poe1", isRunning: false, processName: "" },
    { game: "poe2", isRunning: false, processName: "" },
  ];
}

function createHelperStates(
  runningStates: Array<Omit<HelperStateInput, "isRunning">>,
): HelperStateInput[] {
  const states = createStoppedHelperStates();

  for (const runningState of runningStates) {
    const index = states.findIndex(({ game }) => game === runningState.game);
    states[index] = {
      ...runningState,
      isRunning: true,
      pid: runningState.pid ?? helperDefaultsByGame[runningState.game].pid,
      processName:
        runningState.processName ??
        helperDefaultsByGame[runningState.game].processName,
      windowTitle:
        runningState.windowTitle ??
        helperDefaultsByGame[runningState.game].windowTitle,
    };
  }

  return states;
}

function createExpectedSnapshot(
  activeGame: GameId,
  runningStates: Array<Omit<HelperStateInput, "isRunning">>,
) {
  const states = createStoppedPoeProcessStates();

  for (const runningState of createHelperStates(runningStates)) {
    states[runningState.game] = runningState.isRunning
      ? {
          game: runningState.game,
          isRunning: true,
          pid: runningState.pid ?? helperDefaultsByGame[runningState.game].pid,
          processName:
            runningState.processName ??
            helperDefaultsByGame[runningState.game].processName,
          windowTitle:
            runningState.windowTitle ??
            helperDefaultsByGame[runningState.game].windowTitle,
        }
      : {
          game: runningState.game,
          isRunning: false,
          processName: "",
        };
  }

  return createPoeProcessSnapshot(states, activeGame);
}

async function expectActiveProcessState(
  watcher: PoeProcessWatcher,
  state: PoeProcessState,
): Promise<void> {
  await expect(watcher.pollSnapshot()).resolves.toMatchObject({
    activeState: state,
  });
}

async function expectProcessStateForGame(
  watcher: PoeProcessWatcher,
  game: GameId,
  state: PoeProcessState,
): Promise<void> {
  const snapshot = await watcher.pollSnapshot();

  expect(getPoeProcessStateForGame(snapshot, game)).toEqual(state);
}

function writeHelperState(
  child: FakeWatcherChild,
  states: HelperStateInput[],
): void {
  child.stdout.write(`${JSON.stringify({ type: "state", states })}\n`);
}

function writeRunningHelperState(
  child: FakeWatcherChild,
  runningStates: Array<Omit<HelperStateInput, "isRunning">>,
): void {
  writeHelperState(child, createHelperStates(runningStates));
}

function writeStoppedHelperState(child: FakeWatcherChild): void {
  writeHelperState(child, createStoppedHelperStates());
}

function writeHelperError(child: FakeWatcherChild, message: string): void {
  child.stdout.write(`${JSON.stringify({ type: "error", message })}\n`);
}

describe("PoeProcessWatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spawns the Windows helper and emits Rust-resolved state transitions", () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const data = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    watcher.on("data", data);
    watcher.on("start", start);
    watcher.on("stop", stop);

    watcher.start();

    expect(spawnProcess).toHaveBeenCalledWith(
      helperPath,
      [
        "--title",
        "Hinekora PoE Process Watcher",
        "--parent-pid",
        String(process.pid),
      ],
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }),
    );
    const spawnArgs =
      (spawnProcess.mock.calls[0] as SpawnMockCall | undefined)?.[1] ?? [];
    expect(spawnArgs).not.toContain("-Command");

    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    expect(data).toHaveBeenLastCalledWith(
      createExpectedSnapshot("poe2", [
        {
          game: "poe2",
          processName: "PathOfExileSteam.exe",
        },
      ]),
    );
    expect(start).toHaveBeenCalledWith(
      createExpectedSnapshot("poe2", [
        {
          game: "poe2",
          processName: "PathOfExileSteam.exe",
        },
      ]),
    );

    writeStoppedHelperState(child);

    expect(data).toHaveBeenLastCalledWith(createExpectedSnapshot("poe2", []));
    expect(stop).toHaveBeenCalledWith(
      createExpectedSnapshot("poe2", [
        {
          game: "poe2",
          processName: "PathOfExileSteam.exe",
        },
      ]),
    );

    watcher.stop();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("does not spawn another helper when already started", () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });

    watcher.start();
    watcher.start();

    expect(spawnProcess).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("defaults to the current process platform", () => {
    const watcher = new PoeProcessWatcher();

    expect(watcher.getMode()).toBe("stopped");
  });

  it("buffers partial helper stdout lines", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const data = vi.fn();
    watcher.on("data", data);
    watcher.start();

    child.stdout.write('{"type":"state","states":[');
    expect(data).not.toHaveBeenCalled();

    child.stdout.write(
      '{"game":"poe1","isRunning":true,"pid":1001,"processName":"PathOfExile.exe","windowTitle":"Path of Exile"},' +
        '{"game":"poe2","isRunning":false,"processName":""}]}\n',
    );

    expect(data).toHaveBeenCalledWith(
      createExpectedSnapshot("poe1", [
        {
          game: "poe1",
          pid: 1001,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
      ]),
    );
    watcher.stop();
  });

  it("returns the last helper state for refresh requests", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("keeps the helper active when native helper writes diagnostics to stderr", () => {
    const child = new FakeWatcherChild();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const data = vi.fn();
    const error = vi.fn();
    watcher.on("data", data);
    watcher.on("error", error);

    try {
      watcher.start();
      child.stderr.write("Access denied \n");
      writeRunningHelperState(child, [
        {
          game: "poe2",
          processName: "PathOfExileSteam.exe",
        },
      ]);

      expect(error).not.toHaveBeenCalled();
      expect(watcher.getMode()).toBe("helper");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("PoE process watcher helper diagnostic"),
        expect.objectContaining({ message: "Access denied" }),
      );
      expect(data).toHaveBeenLastCalledWith(
        createExpectedSnapshot("poe2", [
          {
            game: "poe2",
            processName: "PathOfExileSteam.exe",
          },
        ]),
      );
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("limits repeated native helper diagnostic logs", () => {
    const child = new FakeWatcherChild();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });

    try {
      watcher.start();
      child.stderr.write("first warning\n");
      child.stderr.write("second warning\n");
      child.stderr.write("third warning\n");
      child.stderr.write("fourth warning\n");

      expect(warn).toHaveBeenCalledTimes(3);
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining("PoE process watcher helper diagnostic"),
        expect.objectContaining({ message: "fourth warning" }),
      );
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("ignores empty native helper diagnostics", () => {
    const child = new FakeWatcherChild();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });

    try {
      watcher.start();
      child.stderr.write("   \n");

      expect(warn).not.toHaveBeenCalled();
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("keeps the helper active on heartbeat messages", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    child.stdout.write(`${JSON.stringify({ type: "heartbeat" })}\n`);

    expect(error).not.toHaveBeenCalled();
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("ignores blank helper stdout lines", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe2", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    child.stdout.write("\n");

    expect(error).not.toHaveBeenCalled();
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("selects the active game from Rust-resolved helper states", async () => {
    const child = new FakeWatcherChild();
    let activeGame: GameId = "poe1";
    const watcher = new PoeProcessWatcher(() => activeGame, {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });

    activeGame = "poe2";

    await expectActiveProcessState(watcher, {
      game: "poe2",
      isRunning: true,
      pid: 20_002,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    });
    watcher.stop();
  });

  it("exposes both game states while keeping the active game default", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    await expectProcessStateForGame(watcher, "poe2", {
      game: "poe2",
      isRunning: true,
      pid: 20_002,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    });
    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("returns stopped for a game that Rust marked inactive", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    await expectProcessStateForGame(watcher, "poe2", {
      game: "poe2",
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("reads helper snapshots without emitting watcher events", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const data = vi.fn();
    watcher.on("data", data);
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    data.mockClear();

    await expectProcessStateForGame(watcher, "poe2", {
      game: "poe2",
      isRunning: true,
      pid: 20_002,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    });

    expect(data).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("resolves helper snapshots without an active-game resolver", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(undefined, {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    await expect(watcher.pollSnapshot()).resolves.toMatchObject({
      activeGame: null,
      activeState: {
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      },
    });
    watcher.stop();
  });

  it("resolves helper snapshots when the active-game resolver returns null", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => null, {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    await expect(watcher.pollSnapshot()).resolves.toMatchObject({
      activeGame: null,
      activeState: {
        game: "poe2",
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      },
    });
    watcher.stop();
  });

  it("restarts the Windows helper when it exits unexpectedly", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    const stop = vi.fn();
    watcher.on("error", error);
    watcher.on("stop", stop);
    watcher.start();
    writeRunningHelperState(firstChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    firstChild.emit("exit", 1, null);

    await expectProcessStateForGame(watcher, "poe1", {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("helper exited"),
      }),
    );
    expect(stop).not.toHaveBeenCalled();
    expect(watcher.getMode()).toBe("helper");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    await expectProcessStateForGame(watcher, "poe1", {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("includes helper stderr and signal when it exits unexpectedly", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    child.stderr.write("native detail\n");
    child.emit("exit", null, "SIGTERM");

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "PoE process watcher helper exited with code null and signal SIGTERM; stderr: native detail",
      }),
    );
    watcher.stop();
  });

  it("restarts the Windows helper when it emits an error payload", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(watcher.getMode()).toBe("helper");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "subscription failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("uses the fallback error message when helper error payload message is invalid", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    firstChild.stdout.write(
      `${JSON.stringify({ type: "error", message: 42 })}\n`,
    );

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PoE process watcher helper failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("reports a native helper spawn failure", () => {
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: vi.fn(() => {
        throw new Error("spawn failed");
      }),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "spawn failed",
      }),
    );
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("reports a non-error native helper spawn failure", () => {
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: vi.fn(() => {
        throw "spawn failed";
      }),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PoE process watcher helper failed to start",
      }),
    );
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("restarts the Windows helper when the helper process emits an error", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    firstChild.emit("error", new Error("process failed"));

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "process failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("cancels a pending helper restart when stopped", async () => {
    vi.useFakeTimers();
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    watcher.on("error", vi.fn());

    watcher.start();
    writeHelperError(child, "subscription failed");
    watcher.stop();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(1);
    expect(watcher.getMode()).toBe("stopped");
  });

  it("restarts the Windows helper when it emits an unknown payload type", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    firstChild.stdout.write(`${JSON.stringify({ type: "unknown" })}\n`);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("unknown payload type"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when it does not emit initial state", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    expect(watcher.getMode()).toBe("helper");
    await vi.advanceTimersByTimeAsync(3_000);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(watcher.getMode()).toBe("helper");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("initial state"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when health updates stop after initial state", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeStoppedHelperState(firstChild);
    await vi.advanceTimersByTimeAsync(45_000);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stopped sending health updates"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("marks the Windows helper unavailable after bounded restart failures", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const thirdChild = new FakeWatcherChild();
    const fourthChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([
      firstChild,
      secondChild,
      thirdChild,
      fourthChild,
    ]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeHelperError(secondChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(2_000);
    writeHelperError(thirdChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(4_000);
    writeHelperError(fourthChild, "subscription failed");

    expect(spawnProcess).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalledTimes(4);
    expect(watcher.getMode()).toBe("unavailable");
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("does not reset the helper restart budget for immediate state-then-crash loops", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const thirdChild = new FakeWatcherChild();
    const fourthChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([
      firstChild,
      secondChild,
      thirdChild,
      fourthChild,
    ]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeRunningHelperState(firstChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    firstChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    secondChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(2_000);
    writeRunningHelperState(thirdChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    thirdChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(4_000);
    writeRunningHelperState(fourthChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    fourthChild.emit("exit", 1, null);

    expect(spawnProcess).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalledTimes(4);
    expect(watcher.getMode()).toBe("unavailable");
    watcher.stop();
  });

  it("resets the helper restart budget after a stable heartbeat window", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const thirdChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([
      firstChild,
      secondChild,
      thirdChild,
    ]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    await vi.advanceTimersByTimeAsync(30_000);
    secondChild.stdout.write(`${JSON.stringify({ type: "heartbeat" })}\n`);
    secondChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(3);
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("ignores stale exits from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    firstChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("ignores stale errors from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    firstChild.emit("error", new Error("late process error"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(watcher.getMode()).toBe("helper");
    watcher.stop();
  });

  it("ignores stale stdout from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const data = vi.fn();
    const error = vi.fn();
    watcher.on("data", data);
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    data.mockClear();

    writeRunningHelperState(firstChild, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    expect(data).not.toHaveBeenCalled();
    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("ignores stale stderr from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    try {
      watcher.start();
      writeHelperError(firstChild, "subscription failed");
      await vi.advanceTimersByTimeAsync(1_000);
      writeRunningHelperState(secondChild, [
        {
          game: "poe1",
          processName: "PathOfExile.exe",
        },
      ]);
      warn.mockClear();

      firstChild.stderr.write("Access denied \n");

      expect(warn).not.toHaveBeenCalled();
      expect(spawnProcess).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("kills the helper from process-exit cleanup", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const processOnce = vi.spyOn(process, "once");
    const processOff = vi.spyOn(process, "off");

    try {
      watcher.start();
      const cleanup = processOnce.mock.calls.find(
        ([event]) => event === "exit",
      )?.[1] as (() => void) | undefined;

      expect(cleanup).toBeDefined();
      cleanup?.();

      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(processOff).toHaveBeenCalledWith("exit", cleanup);
      expect(watcher.getMode()).toBe("stopped");
    } finally {
      watcher.stop();
      processOnce.mockRestore();
      processOff.mockRestore();
    }
  });

  it("normalizes Rust-resolved helper states", () => {
    expect(
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toEqual({
      poe1: {
        game: "poe1",
        isRunning: true,
        pid: 99,
        processName: "PathOfExile.exe",
        windowTitle: "Path of Exile",
      },
      poe2: {
        game: "poe2",
        isRunning: false,
        processName: "",
      },
    });
  });

  it("rejects malformed helper state entries", () => {
    expect(() => normalizeHelperProcessStates({})).toThrow(
      "invalid state payload",
    );
    expect(() => normalizeHelperProcessStates([null])).toThrow(
      "invalid state entry",
    );
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe3",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
      ]),
    ).toThrow("invalid game id");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        {
          game: "poe1",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("duplicate game state");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
      ]),
    ).toThrow("incomplete state payload");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: "yes",
          processName: "PathOfExile.exe",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("invalid running state");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: -1,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("invalid process id");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("missing process id");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "   ",
          windowTitle: "Path of Exile",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("invalid process name");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: 42,
          windowTitle: "Path of Exile",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("invalid process name");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
          windowTitle: 42,
        },
      ]),
    ).toThrow("invalid window title");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("invalid window title");
    expect(() =>
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: true,
          pid: 99,
          processName: "PathOfExile.exe",
          windowTitle: "",
        },
        {
          game: "poe2",
          isRunning: false,
          processName: "",
        },
      ]),
    ).toThrow("invalid window title");
  });

  it("includes bounded stderr context in helper exit messages", () => {
    expect(createHelperExitMessage(1, null, "")).toBe(
      "PoE process watcher helper exited with code 1 and signal null",
    );
    expect(createHelperExitMessage(null, "SIGTERM", "first\nsecond")).toBe(
      "PoE process watcher helper exited with code null and signal SIGTERM; stderr: first second",
    );
  });

  it("restarts the Windows helper when stdout line size is exceeded", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write("{".repeat(20_000));

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(watcher.getMode()).toBe("helper");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stdout line was too large"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when a completed stdout line is too large", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write(`${"{".repeat(20_000)}\n`);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stdout line was too large"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when a state payload is malformed", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write(`${JSON.stringify({ type: "state" })}\n`);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("invalid state payload"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    await expectActiveProcessState(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("uses the fallback error when state normalization throws a non-error", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    const badState = new Proxy(
      {},
      {
        get() {
          throw "state failed";
        },
      },
    );
    const parse = vi.spyOn(JSON, "parse").mockReturnValue({
      states: [badState],
      type: "state",
    });
    watcher.on("error", error);

    try {
      watcher.start();
      firstChild.stdout.write("state\n");

      expect(firstChild.kill).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PoE process watcher helper emitted invalid state payload",
        }),
      );
    } finally {
      parse.mockRestore();
    }

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when it emits invalid JSON", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write("{not-json}\n");

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("invalid JSON"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when JSON is valid but not a protocol object", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write("null\n");

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("invalid JSON payload"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("marks the Windows helper unavailable when the native helper executable is missing", async () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher(() => "poe1", {
      pathExists: () => false,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    expect(spawnProcess).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("helper executable was not found"),
      }),
    );
    expect(watcher.getMode()).toBe("unavailable");
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("marks the watcher unavailable outside Windows", async () => {
    const watcher = new PoeProcessWatcher(() => "poe1", {
      platform: "linux",
    });

    watcher.start();

    expect(watcher.getMode()).toBe("unavailable");
    await expectActiveProcessState(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("resolves the packaged and development native helper paths", () => {
    const existingPath =
      "C:\\app\\resources\\poe-process-helper\\hinekora-poe-process-helper.exe";
    const pathExists = vi.fn((path: string) => path === existingPath);

    expect(
      resolveWindowsPoeProcessHelperPath({
        cwd: "C:\\repo",
        env: {},
        pathExists,
        resourcesPath: "C:\\app\\resources",
      }),
    ).toBe(existingPath);
    expect(pathExists).toHaveBeenCalledWith(existingPath);

    const configuredPath = "D:\\helpers\\custom-helper.exe";
    expect(
      resolveWindowsPoeProcessHelperPath({
        cwd: "C:\\repo",
        env: {
          HINEKORA_POE_PROCESS_HELPER_PATH: configuredPath,
        },
        pathExists: (path) => path === configuredPath,
        resourcesPath: null,
      }),
    ).toBe(configuredPath);

    const devPath =
      "C:\\repo\\helpers\\bin\\poe-process-helper\\hinekora-poe-process-helper.exe";
    expect(
      resolveWindowsPoeProcessHelperPath({
        cwd: "C:\\repo",
        env: {},
        pathExists: (path) => path === devPath,
        resourcesPath: null,
      }),
    ).toBe(devPath);
  });

  it("falls back to the filesystem when a custom path checker is not provided", () => {
    expect(
      resolveWindowsPoeProcessHelperPath({
        cwd: "C:\\definitely-missing-hinekora-repo",
        env: {},
        resourcesPath: null,
      }),
    ).toBeNull();
  });

  it("reads Electron resourcesPath when path options omit it", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process,
      "resourcesPath",
    );
    const resourcesPath = "C:\\app\\resources";
    const expectedPath =
      "C:\\app\\resources\\poe-process-helper\\hinekora-poe-process-helper.exe";

    try {
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: resourcesPath,
      });
      expect(
        resolveWindowsPoeProcessHelperPath({
          cwd: "C:\\repo",
          env: {},
          pathExists: (path) => path === expectedPath,
        }),
      ).toBe(expectedPath);

      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: "",
      });
      expect(
        resolveWindowsPoeProcessHelperPath({
          cwd: "C:\\repo",
          env: {},
          pathExists: () => false,
        }),
      ).toBeNull();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(process, "resourcesPath", originalDescriptor);
      } else {
        Reflect.deleteProperty(process, "resourcesPath");
      }
    }
  });

  it("does not use development helper paths in packaged runtime", () => {
    const configuredPath = "D:\\helpers\\custom-helper.exe";
    const devPath =
      "C:\\repo\\helpers\\bin\\poe-process-helper\\hinekora-poe-process-helper.exe";
    const pathExists = vi.fn(
      (path: string) => path === configuredPath || path === devPath,
    );

    expect(
      resolveWindowsPoeProcessHelperPath({
        cwd: "C:\\repo",
        env: {
          HINEKORA_POE_PROCESS_HELPER_PATH: configuredPath,
        },
        isPackaged: true,
        pathExists,
        resourcesPath: null,
      }),
    ).toBeNull();
  });
});
