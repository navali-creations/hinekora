import type { spawn as spawnProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Mock } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isWindowsOS } from "~/main/utils/platform";

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

  it("stops audio probes when their export is cancelled", async () => {
    const preAbortedController = new AbortController();
    preAbortedController.abort();
    const preAbortedSpawn = vi.fn() as unknown as typeof spawnProcess;
    await expect(
      probeEditorAudioStream({
        ffprobePath: "ffprobe",
        path: "source.mp4",
        signal: preAbortedController.signal,
        spawnProcess: preAbortedSpawn,
      }),
    ).resolves.toBe(false);
    expect(preAbortedSpawn).not.toHaveBeenCalled();

    const child = createProbeChild();
    const spawnProbe = vi.fn(() => child) as unknown as typeof spawnProcess;
    const controller = new AbortController();
    const result = probeEditorAudioStream({
      ffprobePath: "ffprobe",
      path: "source.mp4",
      signal: controller.signal,
      spawnProcess: spawnProbe,
    });

    controller.abort();

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

    const unknownCloseChild = createProbeChild();
    const unknownCloseProbe = vi.fn(
      () => unknownCloseChild,
    ) as unknown as typeof spawnProcess;
    const unknownCloseResult = probeEditorAudioStream({
      ffprobePath: "ffprobe",
      path: "source.mp4",
      spawnProcess: unknownCloseProbe,
    });
    unknownCloseChild.emit("close", null);
    await expect(unknownCloseResult).resolves.toBe(false);
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

  it("rejects and kills ffmpeg when its export is cancelled", async () => {
    const preAbortedController = new AbortController();
    preAbortedController.abort("cancelled");
    const preAbortedSpawn = vi.fn() as unknown as typeof spawnProcess;
    await expect(
      runEditorFfmpeg("ffmpeg", ["-version"], {
        signal: preAbortedController.signal,
        spawnProcess: preAbortedSpawn,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(preAbortedSpawn).not.toHaveBeenCalled();

    const child = createProbeChild();
    const spawn = vi.fn(() => child) as unknown as typeof spawnProcess;
    const controller = new AbortController();
    const run = runEditorFfmpeg("ffmpeg", ["-version"], {
      signal: controller.signal,
      spawnProcess: spawn,
    });
    controller.abort();
    child.emit("close", null);

    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");

    const errorChild = createProbeChild();
    const errorSpawn = vi.fn(
      () => errorChild,
    ) as unknown as typeof spawnProcess;
    const errorController = new AbortController();
    const errorRun = runEditorFfmpeg("ffmpeg", ["-version"], {
      signal: errorController.signal,
      spawnProcess: errorSpawn,
    });
    errorController.abort(new Error("export stopped"));
    errorChild.emit("error", new Error("process stopped"));

    await expect(errorRun).rejects.toThrow("export stopped");
  });

  it("times out only after ffmpeg progress stops advancing", async () => {
    vi.useFakeTimers();
    const child = createProbeChild();
    const spawn = vi.fn(() => child) as unknown as typeof spawnProcess;
    const run = runEditorFfmpeg("ffmpeg", ["-hang"], {
      progressDurationSeconds: 10,
      spawnProcess: spawn,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(20);
    child.stderr.emit("data", Buffer.from("frame=1 time=00:00:01.00"));
    await vi.advanceTimersByTimeAsync(20);
    expect(child.kill).not.toHaveBeenCalled();
    child.stderr.emit("data", Buffer.from("frame=2 time=00:00:01.00"));
    await vi.advanceTimersByTimeAsync(5);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    child.emit("close", null);

    await expect(run).rejects.toThrow("ffmpeg export timed out");
  });

  it("enforces an absolute timeout while ffmpeg keeps advancing", async () => {
    vi.useFakeTimers();
    const child = createProbeChild();
    const spawn = vi.fn(() => child) as unknown as typeof spawnProcess;
    const run = runEditorFfmpeg("ffmpeg", ["-hang"], {
      absoluteTimeoutMs: 60,
      progressDurationSeconds: 10,
      spawnProcess: spawn,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(20);
    child.stderr.emit("data", Buffer.from("time=00:00:01.00"));
    await vi.advanceTimersByTimeAsync(20);
    child.stderr.emit("data", Buffer.from("time=00:00:02.00"));
    await vi.advanceTimersByTimeAsync(19);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    child.emit("close", null);

    await expect(run).rejects.toThrow("ffmpeg export timed out");
  });

  it("keeps only a bounded stderr tail for failed long-running exports", async () => {
    const child = createProbeChild();
    const spawn = vi.fn(() => child) as unknown as typeof spawnProcess;
    const run = runEditorFfmpeg("ffmpeg", ["-bad"], {
      spawnProcess: spawn,
      timeoutMs: 1_000,
    });

    child.stderr.emit("data", Buffer.from(`discard-me-${"x".repeat(80_000)}`));
    child.stderr.emit("data", Buffer.from("diagnostic-tail"));
    child.emit("close", 2);

    const error = await run.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("diagnostic-tail");
    expect((error as Error).message).not.toContain("discard-me");
    expect((error as Error).message.length).toBeLessThan(1_600);
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
    expect(reporter(Buffer.from("frame=1"))).toBe(false);
    expect(reporter(Buffer.from(" time=00:00:03.00"))).toBe(true);
    expect(reporter(Buffer.from(" time=00:00:11.00"))).toBe(true);
    expect(reporter(Buffer.from(" frame=3"))).toBe(false);

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenNthCalledWith(1, 0.3);
    expect(progress).toHaveBeenNthCalledWith(2, 0.98);

    const disabledProgress = vi.fn();
    expect(
      createFfmpegProgressReporter({
        durationSeconds: 0,
        onProgress: disabledProgress,
      })(Buffer.from("time=00:00:03.00")),
    ).toBe(false);
    expect(
      createFfmpegProgressReporter({ durationSeconds: 10 })(
        Buffer.from("time=00:00:03.00"),
      ),
    ).toBe(true);

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

  it("skips asar virtual packaged ffmpeg paths", async () => {
    vi.resetModules();
    const directory = mkdtempSync(join(tmpdir(), "hinekora-editor-ffmpeg-"));
    const executableName = isWindowsOS() ? "ffmpeg.exe" : "ffmpeg";
    const resourcesPath = join(directory, "resources");
    const virtualPath = join(
      resourcesPath,
      "app.asar",
      "node_modules",
      "noobs",
      "dist",
      "bin",
      executableName,
    );
    const unpackedPath = join(
      resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "noobs",
      "dist",
      "bin",
      executableName,
    );
    const previousFfmpegPath = process.env.HINEKORA_FFMPEG_PATH;
    const previousResourcesPath = process.resourcesPath;
    const existsSync = vi.fn(
      (path: string) => path === virtualPath || path === unpackedPath,
    );
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync,
      };
    });

    try {
      process.env.HINEKORA_FFMPEG_PATH = virtualPath;
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: resourcesPath,
      });
      const { resolveEditorFfmpegPath } = await import("../Editor.ffmpeg");

      expect(resolveEditorFfmpegPath()).toBe(unpackedPath);
      expect(existsSync).toHaveBeenCalledWith(unpackedPath);
      expect(existsSync).not.toHaveBeenCalledWith(virtualPath);
    } finally {
      if (previousFfmpegPath === undefined) {
        delete process.env.HINEKORA_FFMPEG_PATH;
      } else {
        process.env.HINEKORA_FFMPEG_PATH = previousFfmpegPath;
      }
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: previousResourcesPath,
      });
      vi.doUnmock("node:fs");
      vi.resetModules();
      rmSync(directory, { force: true, recursive: true });
    }
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

  it("does not start queued audio probes after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const probe = vi.fn();

    await expect(
      resolveAudioStreamsByPath({
        ffprobePath: "ffprobe",
        paths: ["source.mp4"],
        probe,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(probe).not.toHaveBeenCalled();
  });

  it("renders exports with gaps through the bundled ffmpeg and ffprobe paths", async () => {
    vi.resetModules();
    const directory = mkdtempSync(join(tmpdir(), "hinekora-editor-ffmpeg-"));
    const ffmpegPath = join(directory, "ffmpeg.exe");
    const ffprobePath = join(
      directory,
      isWindowsOS() ? "ffprobe.exe" : "ffprobe",
    );
    const sourcePath = join(directory, "source.mp4");
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
        existsSync: (path: string) =>
          path === ffmpegPath || path === ffprobePath,
      };
    });

    try {
      writeFileSync(ffmpegPath, "");
      writeFileSync(ffprobePath, "");
      process.env.HINEKORA_FFMPEG_PATH = ffmpegPath;
      const { renderEditorExportWithFfmpeg } = await import("../Editor.ffmpeg");
      const progress = vi.fn();

      await renderEditorExportWithFfmpeg({
        onProgress: progress,
        outputPath: join(directory, "output.mp4"),
        resolution: "1080p",
        signal: new AbortController().signal,
        segments: [
          {
            durationSeconds: 1,
            kind: "gap",
            startSeconds: 0,
          },
          {
            durationSeconds: 1.5,
            inSeconds: 0,
            kind: "clip",
            outSeconds: 3,
            playbackRate: 2,
            source: {
              path: sourcePath,
            },
            sourceDurationSeconds: 3,
            startSeconds: 1,
          },
        ],
      });

      const ffmpegCalls = spawn.mock.calls.filter(
        ([executablePath]) => executablePath === ffmpegPath,
      );
      const ffprobeCalls = spawn.mock.calls.filter(
        ([executablePath]) => executablePath === ffprobePath,
      );
      const args = ffmpegCalls[0]?.[1] ?? [];
      expect(args).toContain("-crf");
      expect(args).toContain("21");
      expect(args[args.indexOf("-t") + 1]).toBe("3.000");
      expect(ffprobeCalls).toHaveLength(1);
      expect(ffprobeCalls[0]?.[1]).toContain(sourcePath);
      expect(progress).toHaveBeenCalledWith(1);

      await renderEditorExportWithFfmpeg({
        muteAudio: true,
        outputPath: join(directory, "muted-output.mp4"),
        resolution: "720p",
        segments: [
          {
            durationSeconds: 1,
            inSeconds: 0,
            kind: "clip",
            outSeconds: 1,
            playbackRate: 1,
            source: {
              path: sourcePath,
            },
            sourceDurationSeconds: 1,
            startSeconds: 0,
          },
        ],
      });
      const updatedFfmpegCalls = spawn.mock.calls.filter(
        ([executablePath]) => executablePath === ffmpegPath,
      );
      expect(updatedFfmpegCalls).toHaveLength(2);
      expect(updatedFfmpegCalls[1]?.[1]).toContain("23");
      expect(
        spawn.mock.calls.filter(
          ([executablePath]) => executablePath === ffprobePath,
        ),
      ).toHaveLength(1);
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

  it("preserves render failures without discarding successful renders when filter cleanup is deferred", async () => {
    vi.resetModules();
    const directory = mkdtempSync(join(tmpdir(), "hinekora-editor-ffmpeg-"));
    const ffmpegPath = join(directory, "ffmpeg.exe");
    const previousFfmpegPath = process.env.HINEKORA_FFMPEG_PATH;
    let exitCode = 1;
    let failCleanup = false;
    const spawn = vi.fn(() => {
      const child = createProbeChild();
      queueMicrotask(() => child.emit("close", exitCode));

      return child;
    }) as unknown as Mock<typeof spawnProcess>;
    vi.doMock("node:child_process", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("node:child_process")>();

      return { ...actual, spawn };
    });
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: (path: string) => path === ffmpegPath,
      };
    });
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        rm: async (...args: Parameters<typeof actual.rm>) => {
          if (
            failCleanup &&
            String(args[0]).includes(".hinekora-export-filter-")
          ) {
            throw new Error("filter is locked");
          }

          return actual.rm(...args);
        },
      };
    });

    try {
      writeFileSync(ffmpegPath, "");
      process.env.HINEKORA_FFMPEG_PATH = ffmpegPath;
      const { renderEditorExportWithFfmpeg } = await import("../Editor.ffmpeg");
      const input = {
        muteAudio: true,
        outputPath: join(directory, "output.mp4"),
        resolution: "720p" as const,
        segments: [
          {
            durationSeconds: 1,
            kind: "gap" as const,
            startSeconds: 0,
          },
        ],
      };

      await expect(renderEditorExportWithFfmpeg(input)).rejects.toThrow(
        "ffmpeg export failed",
      );

      failCleanup = true;
      await expect(renderEditorExportWithFfmpeg(input)).rejects.toThrow(
        "Temporary FFmpeg files could not be removed",
      );

      exitCode = 0;
      await expect(
        renderEditorExportWithFfmpeg(input),
      ).resolves.toBeUndefined();
    } finally {
      if (previousFfmpegPath === undefined) {
        delete process.env.HINEKORA_FFMPEG_PATH;
      } else {
        process.env.HINEKORA_FFMPEG_PATH = previousFfmpegPath;
      }
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:fs");
      vi.doUnmock("node:fs/promises");
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
