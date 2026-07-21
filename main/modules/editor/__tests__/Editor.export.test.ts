import { describe, expect, it } from "vitest";

import { defaultEditorTimelinePlaybackRate } from "~/types";
import type { EditorExportClipInput } from "../Editor.dto";
import {
  calculateEditorExportDuration,
  createEditorExportFilterScript,
  createEditorExportSegments,
  createEditorSegmentDiagnostics,
  type EditorExportRenderSegment,
  type EditorResolvedExportClip,
  validateEditorExportTimeline,
} from "../Editor.export";

function createClip(
  overrides: Partial<EditorResolvedExportClip> = {},
): EditorResolvedExportClip {
  return {
    durationSeconds: 3,
    inSeconds: 0,
    outSeconds: 3,
    playbackRate: defaultEditorTimelinePlaybackRate,
    source: { path: "C:\\Videos\\clip.mp4" },
    startSeconds: 0,
    ...overrides,
  };
}

function createInputClip(
  overrides: Partial<EditorExportClipInput> = {},
): EditorExportClipInput {
  return {
    durationSeconds: 3,
    inSeconds: 0,
    outSeconds: 3,
    playbackRate: defaultEditorTimelinePlaybackRate,
    source: { id: "clip-1", kind: "clip" },
    startSeconds: 0,
    ...overrides,
  };
}

describe("Editor export helpers", () => {
  it("preserves leading, middle, and trailing timeline gaps", () => {
    const segments = createEditorExportSegments(
      [
        createClip({
          durationSeconds: 3,
          inSeconds: 1,
          outSeconds: 4,
          startSeconds: 2,
        }),
        createClip({
          durationSeconds: 2,
          outSeconds: 2,
          source: { path: "C:\\Videos\\second.mp4" },
          startSeconds: 7,
        }),
      ],
      10,
    );

    expect(segments).toMatchObject([
      { durationSeconds: 2, kind: "gap", startSeconds: 0 },
      { durationSeconds: 3, kind: "clip", startSeconds: 2 },
      { durationSeconds: 2, kind: "gap", startSeconds: 5 },
      { durationSeconds: 2, kind: "clip", startSeconds: 7 },
      { durationSeconds: 1, kind: "gap", startSeconds: 9 },
    ]);
    expect(calculateEditorExportDuration(segments)).toBe(10);
    expect(createEditorSegmentDiagnostics(segments)).toEqual({
      exportClipSegmentCount: 2,
      exportDurationSeconds: 10,
      exportGapSegmentCount: 3,
      exportSegmentCount: 5,
    });
  });

  it("skips invalid clip durations and rounds non-finite values safely", () => {
    const segments = createEditorExportSegments(
      [
        createClip({
          durationSeconds: Number.NaN,
          inSeconds: 1,
          outSeconds: 1,
          startSeconds: 0,
        }),
        createClip({
          durationSeconds: 0.1234,
          outSeconds: 0.1234,
          startSeconds: 1.2345,
        }),
      ],
      Number.NaN,
    );

    expect(segments).toMatchObject([
      { durationSeconds: 1.235, kind: "gap", startSeconds: 0 },
      { durationSeconds: 0.123, kind: "clip", startSeconds: 1.235 },
    ]);
  });

  it("uses in-points as a secondary sort key", () => {
    const segments = createEditorExportSegments([
      createClip({ inSeconds: 2, outSeconds: 3, startSeconds: 0 }),
      createClip({ inSeconds: 1, outSeconds: 2, startSeconds: 0 }),
    ]);

    expect(segments).toMatchObject([
      { inSeconds: 1, kind: "clip" },
      { inSeconds: 2, kind: "clip" },
    ]);
    expect(
      validateEditorExportTimeline({
        clips: [
          createInputClip({ inSeconds: 2, outSeconds: 3, startSeconds: 0 }),
          createInputClip({ inSeconds: 1, outSeconds: 2, startSeconds: 0 }),
        ],
        maxDurationSeconds: 60,
        timelineDurationSeconds: 2,
      }),
    ).toBe("clips must not overlap");
  });

  it("creates a concat filter with black gaps and silent fallback audio", () => {
    const script = createEditorExportFilterScript({
      resolution: "720p",
      segments: [
        {
          durationSeconds: 1.5,
          kind: "gap",
          startSeconds: 0,
        },
        {
          ...createClip({ durationSeconds: 2, outSeconds: 2 }),
          hasAudio: true,
          inputIndex: 0,
          kind: "clip",
          sourceDurationSeconds: 2,
        },
        {
          ...createClip({
            durationSeconds: 1,
            outSeconds: 1,
            source: { path: "C:\\Videos\\silent.mp4" },
          }),
          hasAudio: false,
          inputIndex: 1,
          kind: "clip",
          sourceDurationSeconds: 1,
        },
      ] satisfies EditorExportRenderSegment[],
    });

    expect(script).toContain("color=c=black:s=1280x720:r=30");
    expect(script).toContain(
      "anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=1.500",
    );
    expect(script).toContain("[0:a:0]atrim=duration=2.000");
    expect(script).toContain(
      "scale=1280:720:force_original_aspect_ratio=decrease",
    );
    expect(script).toContain("[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1");
  });

  it("creates video and audio speed filters for adjusted clips", () => {
    const segments = createEditorExportSegments([
      createClip({
        durationSeconds: 1.5,
        outSeconds: 3,
        playbackRate: 2,
      }),
      createClip({
        durationSeconds: 4,
        inSeconds: 3,
        outSeconds: 4,
        playbackRate: 0.25,
        startSeconds: 1.5,
      }),
      createClip({
        durationSeconds: 1,
        outSeconds: 16,
        playbackRate: 16,
        startSeconds: 5.5,
      }),
    ]);
    const clipSegments = segments.filter((segment) => segment.kind === "clip");

    expect(clipSegments).toMatchObject([
      {
        durationSeconds: 1.5,
        playbackRate: 2,
        sourceDurationSeconds: 3,
      },
      {
        durationSeconds: 4,
        playbackRate: 0.25,
        sourceDurationSeconds: 1,
      },
      {
        durationSeconds: 1,
        playbackRate: 16,
        sourceDurationSeconds: 16,
      },
    ]);

    const script = createEditorExportFilterScript({
      resolution: "1080p",
      segments: [
        {
          ...clipSegments[0]!,
          hasAudio: true,
          inputIndex: 0,
        },
        {
          ...clipSegments[1]!,
          hasAudio: true,
          inputIndex: 1,
        },
        {
          ...clipSegments[2]!,
          hasAudio: true,
          inputIndex: 2,
        },
      ] satisfies EditorExportRenderSegment[],
    });

    expect(script).toContain("trim=duration=3.000,setpts=(PTS-STARTPTS)/2.000");
    expect(script).toContain(
      "atrim=duration=3.000,asetpts=PTS-STARTPTS,atempo=2.000",
    );
    expect(script).toContain("trim=duration=1.000,setpts=(PTS-STARTPTS)/0.250");
    expect(script).toContain(
      "atrim=duration=1.000,asetpts=PTS-STARTPTS,atempo=0.500,atempo=0.500",
    );
    expect(script).toContain(
      "trim=duration=16.000,setpts=(PTS-STARTPTS)/16.000",
    );
    expect(script).toContain(
      "atrim=duration=16.000,asetpts=PTS-STARTPTS,atempo=2.000,atempo=2.000,atempo=2.000,atempo=2.000",
    );
  });

  it("creates 1080p filters", () => {
    expect(
      createEditorExportFilterScript({
        resolution: "1080p",
        segments: [
          {
            ...createClip({ durationSeconds: 1, outSeconds: 1 }),
            hasAudio: true,
            inputIndex: 0,
            kind: "clip",
            sourceDurationSeconds: 1,
          },
        ],
      }),
    ).toContain("scale=1920:1080");
  });

  it("uses silent audio for muted exports", () => {
    const script = createEditorExportFilterScript({
      muteAudio: true,
      resolution: "1080p",
      segments: [
        {
          ...createClip({ durationSeconds: 1, outSeconds: 1 }),
          hasAudio: true,
          inputIndex: 0,
          kind: "clip",
          sourceDurationSeconds: 1,
        },
      ],
    });

    expect(script).not.toContain("[0:a:0]atrim");
    expect(script).toContain(
      "anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=1.000",
    );
  });

  it("rejects invalid timeline render shapes", () => {
    expect(
      validateEditorExportTimeline({
        clips: [
          createInputClip({
            durationSeconds: 5,
            outSeconds: 5,
            startSeconds: 0,
          }),
          createInputClip({
            durationSeconds: 3,
            outSeconds: 3,
            source: { id: "clip-2", kind: "clip" },
            startSeconds: 4,
          }),
        ],
        maxDurationSeconds: 60,
        timelineDurationSeconds: 10,
      }),
    ).toBe("clips must not overlap");
    expect(
      validateEditorExportTimeline({
        clips: [createInputClip({ durationSeconds: 5, outSeconds: 5 })],
        maxDurationSeconds: 60,
        timelineDurationSeconds: 4,
      }),
    ).toBe("clip extends past duration");
    expect(
      validateEditorExportTimeline({
        clips: [createInputClip()],
        maxDurationSeconds: 2,
        timelineDurationSeconds: 10,
      }),
    ).toBe("duration is too large");
    expect(
      validateEditorExportTimeline({
        clips: [
          createInputClip({
            durationSeconds: Number.NaN,
            outSeconds: 1,
          }),
        ],
        maxDurationSeconds: 60,
        timelineDurationSeconds: 10,
      }),
    ).toBeNull();
  });
});
