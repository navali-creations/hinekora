import type {
  EditorExportClipInput,
  EditorExportResolution,
} from "./Editor.dto";

const minimumSegmentDurationSeconds = 0.001;
const timelineValidationToleranceSeconds = 0.001;

interface EditorResolvedExportClip
  extends Omit<EditorExportClipInput, "source"> {
  source: {
    path: string;
  };
}

interface EditorExportGapSegment {
  durationSeconds: number;
  kind: "gap";
  startSeconds: number;
}

interface EditorExportClipSegment extends EditorResolvedExportClip {
  kind: "clip";
}

type EditorExportSegment = EditorExportClipSegment | EditorExportGapSegment;

interface EditorExportRenderGapSegment extends EditorExportGapSegment {
  kind: "gap";
}

interface EditorExportRenderClipSegment extends EditorExportClipSegment {
  hasAudio: boolean;
  inputIndex: number;
  kind: "clip";
}

type EditorExportRenderSegment =
  | EditorExportRenderClipSegment
  | EditorExportRenderGapSegment;

interface EditorExportSize {
  height: number;
  width: number;
}

function createEditorExportSegments(
  clips: EditorResolvedExportClip[],
  timelineDurationSeconds = 0,
): EditorExportSegment[] {
  const segments: EditorExportSegment[] = [];
  let cursorSeconds = 0;

  for (const clip of [...clips].sort(
    (first, second) =>
      first.startSeconds - second.startSeconds ||
      first.inSeconds - second.inSeconds,
  )) {
    const startSeconds = roundToMilliseconds(Math.max(0, clip.startSeconds));
    const durationSeconds = roundToMilliseconds(
      Math.min(clip.durationSeconds, clip.outSeconds - clip.inSeconds),
    );
    if (durationSeconds < minimumSegmentDurationSeconds) {
      continue;
    }

    if (startSeconds > cursorSeconds) {
      segments.push(createGapSegment(cursorSeconds, startSeconds));
    }

    segments.push({
      ...clip,
      durationSeconds,
      kind: "clip",
      startSeconds,
    });
    cursorSeconds = roundToMilliseconds(
      Math.max(cursorSeconds, startSeconds + durationSeconds),
    );
  }

  const timelineEndSeconds = roundToMilliseconds(
    Math.max(cursorSeconds, timelineDurationSeconds),
  );
  if (timelineEndSeconds > cursorSeconds) {
    segments.push(createGapSegment(cursorSeconds, timelineEndSeconds));
  }

  return segments;
}

function createEditorExportFilterScript(input: {
  resolution: EditorExportResolution;
  segments: EditorExportRenderSegment[];
}): string {
  const size = resolveEditorExportSize(input.resolution);
  const lines: string[] = [];
  const concatLabels: string[] = [];

  input.segments.forEach((segment, index) => {
    const videoLabel = `v${index}`;
    const audioLabel = `a${index}`;
    concatLabels.push(`[${videoLabel}][${audioLabel}]`);

    if (segment.kind === "gap") {
      lines.push(
        `color=c=black:s=${size.width}x${size.height}:r=30,trim=duration=${formatFfmpegSeconds(
          segment.durationSeconds,
        )},setpts=PTS-STARTPTS,format=yuv420p[${videoLabel}]`,
      );
      lines.push(
        `${createSilentAudioFilter(segment.durationSeconds)}[${audioLabel}]`,
      );
      return;
    }

    lines.push(
      `[${segment.inputIndex}:v:0]trim=duration=${formatFfmpegSeconds(
        segment.durationSeconds,
      )},setpts=PTS-STARTPTS,${createScaleFilter(size)}[${videoLabel}]`,
    );
    lines.push(
      segment.hasAudio
        ? `[${segment.inputIndex}:a:0]atrim=duration=${formatFfmpegSeconds(
            segment.durationSeconds,
          )},asetpts=PTS-STARTPTS[${audioLabel}]`
        : `${createSilentAudioFilter(segment.durationSeconds)}[${audioLabel}]`,
    );
  });

  lines.push(
    `${concatLabels.join("")}concat=n=${input.segments.length}:v=1:a=1[outv][outa]`,
  );

  return `${lines.join(";\n")}\n`;
}

function calculateEditorExportDuration(
  segments: EditorExportSegment[],
): number {
  return roundToMilliseconds(
    segments.reduce(
      (durationSeconds, segment) => durationSeconds + segment.durationSeconds,
      0,
    ),
  );
}

function validateEditorExportTimeline(input: {
  clips: EditorExportClipInput[];
  maxDurationSeconds: number;
  timelineDurationSeconds: number;
}): string | null {
  const timelineDurationSeconds = roundToMilliseconds(
    input.timelineDurationSeconds,
  );
  if (timelineDurationSeconds > input.maxDurationSeconds) {
    return "duration is too large";
  }

  let cursorSeconds = 0;
  for (const clip of [...input.clips].sort(
    (first, second) =>
      first.startSeconds - second.startSeconds ||
      first.inSeconds - second.inSeconds,
  )) {
    const startSeconds = roundToMilliseconds(clip.startSeconds);
    const durationSeconds = roundToMilliseconds(
      Math.min(clip.durationSeconds, clip.outSeconds - clip.inSeconds),
    );
    const endSeconds = roundToMilliseconds(startSeconds + durationSeconds);

    if (durationSeconds < minimumSegmentDurationSeconds) {
      continue;
    }
    if (startSeconds < cursorSeconds - timelineValidationToleranceSeconds) {
      return "clips must not overlap";
    }
    if (
      endSeconds >
      timelineDurationSeconds + timelineValidationToleranceSeconds
    ) {
      return "clip extends past duration";
    }

    cursorSeconds = Math.max(cursorSeconds, endSeconds);
  }

  return null;
}

function resolveEditorExportSize(
  resolution: EditorExportResolution,
): EditorExportSize {
  return resolution === "720p"
    ? { height: 720, width: 1280 }
    : { height: 1080, width: 1920 };
}

function createGapSegment(
  startSeconds: number,
  endSeconds: number,
): EditorExportGapSegment {
  return {
    durationSeconds: roundToMilliseconds(endSeconds - startSeconds),
    kind: "gap",
    startSeconds: roundToMilliseconds(startSeconds),
  };
}

function createScaleFilter(size: EditorExportSize): string {
  return `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;
}

function createSilentAudioFilter(durationSeconds: number): string {
  return `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${formatFfmpegSeconds(
    durationSeconds,
  )},asetpts=PTS-STARTPTS`;
}

function formatFfmpegSeconds(seconds: number): string {
  return roundToMilliseconds(seconds).toFixed(3);
}

function roundToMilliseconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Math.round(Math.max(0, seconds) * 1_000) / 1_000;
}

export {
  calculateEditorExportDuration,
  createEditorExportFilterScript,
  createEditorExportSegments,
  type EditorExportRenderSegment,
  type EditorExportSegment,
  type EditorResolvedExportClip,
  validateEditorExportTimeline,
};
