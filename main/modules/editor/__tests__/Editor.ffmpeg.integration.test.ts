import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createFfmpegTestSource,
  decodeFfmpegTestMedia,
  probeFfmpegTestMedia,
} from "~/main/test/ffmpeg-integration";
import { isWindowsOS } from "~/main/utils/platform";

import {
  type EditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
} from "~/types";
import {
  createEditorExportSegments,
  type EditorResolvedExportClip,
} from "../Editor.export";
import { renderEditorExportWithFfmpeg } from "../Editor.ffmpeg";

const sourceDurationSeconds = 3.2;
const timelineShapes = ["single", "multiple"] as const;
const playbackRateRenderCases = editorTimelinePlaybackRates.flatMap(
  (playbackRate) => timelineShapes.map((shape) => ({ playbackRate, shape })),
);

describe.runIf(isWindowsOS())(
  "editor playback speed rendering integration",
  () => {
    let directory = "";
    let sourcePath = "";

    beforeAll(async () => {
      directory = await mkdtemp(join(tmpdir(), "hinekora-editor-speed-"));
      sourcePath = join(directory, "source.mp4");

      await createFfmpegTestSource({
        durationSeconds: sourceDurationSeconds,
        outputPath: sourcePath,
        withAudio: true,
      });
    }, 20_000);

    afterAll(async () => {
      if (directory) {
        await rm(directory, { force: true, recursive: true });
      }
    });

    it.each(
      playbackRateRenderCases,
    )("renders and decodes a $shape timeline at $playbackRate x", async ({
      playbackRate,
      shape,
    }) => {
      const outputPath = join(
        directory,
        `${shape}-${String(playbackRate).replace(".", "-")}x.mp4`,
      );
      const { durationSeconds, segments } = createPlaybackRateSegments({
        playbackRate,
        shape,
        sourcePath,
      });

      await renderEditorExportWithFfmpeg({
        outputPath,
        resolution: "720p",
        segments,
      });
      await expectPlayableEditorExport(outputPath, durationSeconds);
    }, 30_000);
  },
);

function createPlaybackRateSegments(input: {
  playbackRate: EditorTimelinePlaybackRate;
  shape: (typeof timelineShapes)[number];
  sourcePath: string;
}) {
  const sourceRanges =
    input.shape === "single"
      ? [{ inSeconds: 0, outSeconds: sourceDurationSeconds }]
      : [
          { inSeconds: 0, outSeconds: sourceDurationSeconds / 2 },
          {
            inSeconds: sourceDurationSeconds / 2,
            outSeconds: sourceDurationSeconds,
          },
        ];
  let startSeconds = 0;
  const clips: EditorResolvedExportClip[] = sourceRanges.map((range) => {
    const durationSeconds = roundToMilliseconds(
      (range.outSeconds - range.inSeconds) / input.playbackRate,
    );
    const clip: EditorResolvedExportClip = {
      durationSeconds,
      inSeconds: range.inSeconds,
      outSeconds: range.outSeconds,
      playbackRate: input.playbackRate,
      source: { path: input.sourcePath },
      startSeconds,
    };
    startSeconds = roundToMilliseconds(startSeconds + durationSeconds);

    return clip;
  });

  return {
    durationSeconds: startSeconds,
    segments: createEditorExportSegments(clips, startSeconds),
  };
}

async function expectPlayableEditorExport(
  outputPath: string,
  expectedDurationSeconds: number,
) {
  const metadata = await probeFfmpegTestMedia(outputPath);
  const videoStream = metadata.streams.find(
    (stream) => stream.codecType === "video",
  );
  const audioStream = metadata.streams.find(
    (stream) => stream.codecType === "audio",
  );

  expect(videoStream).toMatchObject({
    codecName: "h264",
    height: 720,
    width: 1280,
  });
  expect(audioStream).toMatchObject({ codecName: "aac" });
  expect(metadata.sizeBytes).toBeGreaterThan(0);
  expect(Number.isFinite(metadata.durationSeconds)).toBe(true);
  expect(metadata.durationSeconds).toBeGreaterThan(0);
  expect(
    Math.abs(metadata.durationSeconds - expectedDurationSeconds),
  ).toBeLessThan(Math.max(0.06, expectedDurationSeconds * 0.03));

  await decodeFfmpegTestMedia({
    outputPath,
    withAudio: true,
  });
}

function roundToMilliseconds(seconds: number): number {
  return Math.round(seconds * 1_000) / 1_000;
}
