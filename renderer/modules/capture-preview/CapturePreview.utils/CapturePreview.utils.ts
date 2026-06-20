import type { CapturePreviewSource, CaptureTarget } from "~/types";

export function sourceMatchesCaptureTarget(
  source: CapturePreviewSource,
  captureTarget: CaptureTarget | null | undefined,
): boolean {
  if (!captureTarget) {
    return false;
  }

  if (captureTarget.kind === "display") {
    return (
      source.kind === "screen" &&
      (source.id === captureTarget.id || source.displayId === captureTarget.id)
    );
  }

  return source.kind === "window" && source.id === captureTarget.id;
}

export function findCapturePreviewSourceForTarget(
  captureTarget: CaptureTarget | null | undefined,
  sources: CapturePreviewSource[],
): CapturePreviewSource | null {
  return (
    sources.find((source) =>
      sourceMatchesCaptureTarget(source, captureTarget),
    ) ?? null
  );
}

export function resolveCapturePreviewSourceId(
  captureTarget: CaptureTarget | null | undefined,
  sources: CapturePreviewSource[],
  selectedSourceId: string | null,
): string | null {
  const profileSource = findCapturePreviewSourceForTarget(
    captureTarget,
    sources,
  );
  if (profileSource) {
    return profileSource.id;
  }

  if (sources.some((source) => source.id === selectedSourceId)) {
    return selectedSourceId;
  }

  return (
    sources.find((source) => source.kind === "screen")?.id ??
    sources[0]?.id ??
    null
  );
}
