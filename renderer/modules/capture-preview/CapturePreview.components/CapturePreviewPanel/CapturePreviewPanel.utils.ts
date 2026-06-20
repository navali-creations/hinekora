import type { CapturePreviewSource, CaptureTarget } from "~/types";

export function createDesktopPreviewConstraints(
  sourceId: string,
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: 3840,
        maxHeight: 2160,
        maxFrameRate: 30,
      },
    } as unknown as MediaTrackConstraints,
  };
}

export function createCaptureTargetFromPreviewSource(
  source: CapturePreviewSource,
): CaptureTarget {
  return {
    kind: source.kind === "screen" ? "display" : "window",
    id: source.kind === "screen" ? (source.displayId ?? source.id) : source.id,
    label: source.name,
    width: source.width,
    height: source.height,
  };
}

export function isSameCaptureTarget(
  left: CaptureTarget | null,
  right: CaptureTarget,
): boolean {
  return (
    left?.kind === right.kind &&
    left.id === right.id &&
    left.label === right.label &&
    left.width === right.width &&
    left.height === right.height
  );
}
