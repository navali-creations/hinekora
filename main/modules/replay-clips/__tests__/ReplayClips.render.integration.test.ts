import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { isWindowsOS } from "~/main/utils/platform";

import { renderReplayClipQuickTrim } from "../ReplayClips.render";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const ffmpegPath = resolve("node_modules/noobs/dist/bin/ffmpeg.exe");
const ffprobePath = resolve("node_modules/noobs/dist/bin/ffprobe.exe");

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe.runIf(isWindowsOS())(
  "replay clip preview rendering integration",
  () => {
    it("renders a playable 720p H.264 proxy with the bundled ffmpeg", async () => {
      const directory = await mkdtemp(join(tmpdir(), "hinekora-preview-"));
      temporaryDirectories.push(directory);
      const sourcePath = join(directory, "source.mp4");
      const outputPath = join(directory, "preview.mp4");

      await execFileAsync(ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=640x360:rate=30:duration=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        sourcePath,
      ]);
      await renderReplayClipQuickTrim({
        outputPath,
        resolution: "720p",
        sourcePath,
        trim: { inSeconds: 0.1, outSeconds: 0.8 },
      });

      const { stdout } = await execFileAsync(ffprobePath, [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height",
        "-of",
        "json",
        outputPath,
      ]);
      const metadata = JSON.parse(stdout) as {
        streams: Array<{ codec_name: string; height: number; width: number }>;
      };

      expect(metadata.streams[0]).toEqual({
        codec_name: "h264",
        height: 720,
        width: 1280,
      });
    }, 20_000);
  },
);
