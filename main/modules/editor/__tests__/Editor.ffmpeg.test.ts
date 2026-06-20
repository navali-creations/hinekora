import type { spawn as spawnProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Mock } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFfmpegProgressReporter,
  parseFfmpegProgressSeconds,
  probeEditorAudioStream,
  resolveAudioStreamsByPath,
  runEditorFfmpeg,
} from "../Editor.ffmpeg";

describe("probeEditorAudioStream", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns whether ffprobe found an audio stream", async () => {
    const child = createProbeChild();
    const spawnProbe = vi.fn(() => child) as unknown as typeof spawnProcess;
    const result = probeEditorAudioStream({
      ffprobePath: "ffprobe",
      path: "source.mp4",
      spawnProcess: spawnProbe,
    });

    child.stdout.emit("data", Buffer.from("0\n"));
    child.emit("close", 0);

    await expect(result).resolves.toBe(true);
    expect(spawnProbe).toHaveBeenCalledWith(
      "ffprobe",
      expect.arrayContaining(["-select_streams", "a:0", "source.mp4"]),
      { windowsHide: true },
    );
  });

  it("times out a stalled probe and kills the child process", async () => {
    vi.useFakeTimers();
    const child = createProbeChild();
    const spawnProbe = vi.fn(() => child) as unknown as typeof spawnProcess;
    const result = probeEditorAudioStream({
      ffprobePath: "ffprobe",
      path: "source.mp4",
      spawnProcess: spawnProbe,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe(false);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");

    child.emit("close", 0);
  });

  it("covers probe error and non-zero close paths once", async () => {
    const errorChild = createProbeChild();
    const errorProbe = vi.fn(
      () => errorChild,
    ) as unknown as typeof spawnProcess;
    const errorResult = probeEditorAudioStream({
      ffprobePath: "ffprobe",
      path: "source.mp4",
      spawnProcess: errorProbe,
    });
    errorChild.emit("error", new Error("spawn failed"));
    errorChild.emit("close", 0);
    await expect(errorResult).resolves.toBe(false);

    const closeChild = createProbeChild();
    const closeProbe = vi.fn(
      () => closeChild,
    ) as unknown as typeof spawnProcess;
    const closeResult = probeEditorAudioStream({
      ffprobePath: "ffprobe",
      path: "source.mp4",
      spawnProcess: closeProbe,
    });
    closeChild.stderr.emit("data", Buffer.from("no audio"));
    closeChild.emit("close", 1);
    await expect(closeResult).resolves.toBe(false);
  });

  it("resolves, rejects, and times out ffmpeg process runs", async () => {
    const successChild = createProbeChild();
    const successSpawn = vi.fn(
      () => successChild,
    ) as unknown as typeof spawnProcess;
    const success = runEditorFfmpeg("ffmpeg", ["-version"], {
      spawnProcess: successSpawn,
      timeoutMs: 1_000,
    });
    successChild.emit("close", 0);
    successChild.emit("error", new Error("late spawn error"));
    await expect(success).resolves.toBeUndefined();

    const errorChild = createProbeChild();
    const errorSpawn = vi.fn(
      () => errorChild,
    ) as unknown as typeof spawnProcess;
    const errorRun = runEditorFfmpeg("ffmpeg", ["-bad"], {
      spawnProcess: errorSpawn,
      timeoutMs: 1_000,
    });
    errorChild.emit("error", new Error("spawn failed"));
    await expect(errorRun).rejects.toThrow("spawn failed");

    const failedChild = createProbeChild();
    const failedSpawn = vi.fn(
      () => failedChild,
    ) as unknown as typeof spawnProcess;
    const failedRun = runEditorFfmpeg("ffmpeg", ["-bad"], {
      spawnProcess: failedSpawn,
      timeoutMs: 1_000,
    });
    failedChild.stderr.emit("data", Buffer.from("bad args"));
    failedChild.emit("close", 2);
    await expect(failedRun).rejects.toThrow("ffmpeg export failed: bad args");

    const unknownCodeChild = createProbeChild();
    const unknownCodeSpawn = vi.fn(
      () => unknownCodeChild,
    ) as unknown as typeof spawnProcess;
    const unknownCodeRun = runEditorFfmpeg("ffmpeg", ["-bad"], {
      spawnProcess: unknownCodeSpawn,
      timeoutMs: 1_000,
    });
    unknownCodeChild.emit("close", null);
    await expect(unknownCodeRun).rejects.toThrow(
      "ffmpeg export failed with code unknown",
    );

    vi.useFakeTimers();
    const timeoutChild = createProbeChild();
    const timeoutSpawn = vi.fn(
      () => timeoutChild,
    ) as unknown as typeof spawnProcess;
    const timeoutRun = runEditorFfmpeg("ffmpeg", ["-hang"], {
      spawnProcess: timeoutSpawn,
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(25);
    timeoutChild.emit("close", null);
    await expect(timeoutRun).rejects.toThrow("ffmpeg export timed out");
    expect(timeoutChild.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("parses and reports ffmpeg progress", async () => {
    expect(parseFfmpegProgressSeconds("frame=1")).toBeNull();
    expect(
      parseFfmpegProgressSeconds(
        "frame=1 time=00:00:01.25 frame=2 time=00:01:02.50",
      ),
    ).toBe(62.5);

    const progress = vi.fn();
    const reporter = createFfmpegProgressReporter({
      durationSeconds: 10,
      onProgress: progress,
    });
    reporter(Buffer.from("frame=1"));
    reporter(Buffer.from(" time=00:00:03.00"));
    reporter(Buffer.from(" time=00:00:11.00"));

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenNthCalledWith(1, 0.3);
    expect(progress).toHaveBeenNthCalledWith(2, 0.98);

    const disabledProgress = vi.fn();
    createFfmpegProgressReporter({
      durationSeconds: 0,
      onProgress: disabledProgress,
    })(Buffer.from("time=00:00:03.00"));
    createFfmpegProgressReporter({ durationSeconds: 10 })(
      Buffer.from("time=00:00:03.00"),
    );

    expect(disabledProgress).not.toHaveBeenCalled();
  });

  it("reports ffmpeg completion progress", async () => {
    const child = createProbeChild();
    const progress = vi.fn();
    const spawn = vi.fn(() => child) as unknown as typeof spawnProcess;
    const run = runEditorFfmpeg("ffmpeg", ["-version"], {
      onProgress: progress,
      progressDurationSeconds: 10,
      spawnProcess: spawn,
      timeoutMs: 1_000,
    });

    child.stderr.emit("data", Buffer.from("frame=1 time=00:00:05.00"));
    child.emit("close", 0);

    await expect(run).resolves.toBeUndefined();
    expect(progress).toHaveBeenCalledWith(0.5);
    expect(progress).toHaveBeenLastCalledWith(1);
  });

  it("probes unique audio paths with bounded concurrency", async () => {
    const calls: string[] = [];
    const releaseByPath = new Map<string, () => void>();
    let activeProbes = 0;
    let maxActiveProbes = 0;
    const resultPromise = resolveAudioStreamsByPath({
      concurrency: 2,
      ffprobePath: "ffprobe",
      paths: ["a.mp4", "b.mp4", "a.mp4", "c.mp4"],
      probe: async ({ path }) => {
        calls.push(path);
        activeProbes += 1;
        maxActiveProbes = Math.max(maxActiveProbes, activeProbes);
        await new Promise<void>((resolve) => {
          releaseByPath.set(path, resolve);
        });
        activeProbes -= 1;

        return path !== "b.mp4";
      },
    });

    await vi.waitFor(() => {
      expect(calls).toEqual(["a.mp4", "b.mp4"]);
    });
    expect(maxActiveProbes).toBe(2);

    releaseByPath.get("a.mp4")?.();
    await vi.waitFor(() => {
      expect(calls).toEqual(["a.mp4", "b.mp4", "c.mp4"]);
    });
    releaseByPath.get("b.mp4")?.();
    releaseByPath.get("c.mp4")?.();

    await expect(resultPromise).resolves.toEqual(
      new Map([
        ["a.mp4", true],
        ["b.mp4", false],
        ["c.mp4", true],
      ]),
    );
    expect(maxActiveProbes).toBe(2);
  });

  it("skips audio probing when there are no clip paths", async () => {
    const probe = vi.fn();

    await expect(
      resolveAudioStreamsByPath({
        ffprobePath: "ffprobe",
        paths: [],
        probe,
      }),
    ).resolves.toEqual(new Map());
    expect(probe).not.toHaveBeenCalled();
  });

  it("renders 1080p exports through the bundled ffmpeg path without ffprobe", async () => {
    vi.resetModules();
    const directory = mkdtempSync(join(tmpdir(), "hinekora-editor-ffmpeg-"));
    const ffmpegPath = join(directory, "ffmpeg.exe");
    const previousFfmpegPath = process.env.HINEKORA_FFMPEG_PATH;
    const spawn = vi.fn(() => {
      const child = createProbeChild();
      queueMicrotask(() => child.emit("close", 0));

      return child;
    }) as unknown as Mock<typeof spawnProcess>;
    vi.doMock("node:child_process", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("node:child_process")>();

      return {
        ...actual,
        spawn,
      };
    });
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: (path: string) => path === ffmpegPath,
      };
    });

    try {
      writeFileSync(ffmpegPath, "");
      process.env.HINEKORA_FFMPEG_PATH = ffmpegPath;
      const { renderEditorExportWithFfmpeg } = await import("../Editor.ffmpeg");
      const progress = vi.fn();

      await renderEditorExportWithFfmpeg({
        onProgress: progress,
        outputPath: join(directory, "output.mp4"),
        resolution: "1080p",
        segments: [
          {
            durationSeconds: 1,
            inSeconds: 0,
            kind: "clip",
            outSeconds: 1,
            source: {
              path: join(directory, "source.mp4"),
            },
            startSeconds: 0,
          },
        ],
      });

      const args = spawn.mock.calls[0]?.[1] ?? [];
      expect(args).toContain("-crf");
      expect(args).toContain("21");
      expect(progress).toHaveBeenCalledWith(1);
    } finally {
      if (previousFfmpegPath === undefined) {
        delete process.env.HINEKORA_FFMPEG_PATH;
      } else {
        process.env.HINEKORA_FFMPEG_PATH = previousFfmpegPath;
      }
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:fs");
      vi.resetModules();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

function createProbeChild() {
  return Object.assign(new EventEmitter(), {
    kill: vi.fn(),
    stderr: new EventEmitter(),
    stdout: new EventEmitter(),
  }) as EventEmitter & {
    kill: Mock;
    stderr: EventEmitter;
    stdout: EventEmitter;
  };
}
