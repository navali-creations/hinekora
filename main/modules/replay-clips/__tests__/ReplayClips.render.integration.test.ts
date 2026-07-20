import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createFfmpegTestSource,
  decodeFfmpegTestMedia,
  probeFfmpegTestMedia,
} from "~/main/test/ffmpeg-integration";
import { isWindowsOS } from "~/main/utils/platform";

import { renderReplayClipQuickTrim } from "../ReplayClips.render";

const temporaryDirectories: string[] = [];

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

      await createFfmpegTestSource({
        durationSeconds: 1,
        outputPath: sourcePath,
        size: "640x360",
        withAudio: false,
      });
      await renderReplayClipQuickTrim({
        outputPath,
        resolution: "720p",
        sourcePath,
        trim: { inSeconds: 0.1, outSeconds: 0.8 },
      });

      const metadata = await probeFfmpegTestMedia(outputPath);
      const videoStream = metadata.streams.find(
        (stream) => stream.codecType === "video",
      );

      expect(videoStream).toMatchObject({
        codecName: "h264",
        height: 720,
        width: 1280,
      });
      await decodeFfmpegTestMedia({ outputPath, withAudio: false });
    }, 20_000);
  },
);
