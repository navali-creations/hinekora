import type { ReplayClipDetail } from "~/main/modules/replay-clips";

function getClipPreviewFileTitle(path: string | null): string {
  if (!path) {
    return "";
  }

  const fileName = path.split(/[\\/]/).pop() ?? path;
  return fileName.replace(/\.[^.]+$/, "");
}

function resolveClipPreviewDetail(
  detail: ReplayClipDetail | null,
  durationOverrideSeconds: number | null,
) {
  const clip = detail?.clip ?? null;
  const durationSeconds = Math.max(
    0,
    detail?.durationSeconds ??
      durationOverrideSeconds ??
      clip?.durationSeconds ??
      clip?.targetDurationSeconds ??
      0,
  );
  const mediaUrl = detail?.mediaUrl ?? null;
  const previewMediaUrl = detail?.previewMediaUrl ?? null;

  return {
    clip,
    clipFileName: clip?.fileName ?? null,
    durationSeconds,
    hasPlayableClipFile: Boolean(
      clip?.hasMediaFile &&
        (previewMediaUrl ?? mediaUrl) &&
        durationSeconds > 0,
    ),
    mediaUrl,
    previewMediaUrl,
  };
}

function resolveClipPreviewHeaderState(input: {
  detail: ReplayClipDetail | null;
  detailError: string | null;
  durationOverrideSeconds: number | null;
}): { subtitle: string; title: string } {
  const { clip } = resolveClipPreviewDetail(
    input.detail,
    input.durationOverrideSeconds,
  );
  if (!clip) {
    return {
      subtitle: input.detailError || "Waiting for clip metadata",
      title: "Loading Replay",
    };
  }
  if (clip.status === "failed") {
    return {
      subtitle: clip.error ?? "Replay save failed",
      title: "Replay Failed",
    };
  }

  const isClipReady = clip.hasMediaFile;
  return {
    subtitle: isClipReady
      ? `${clip.sourceGame.toUpperCase()} - ${new Date(
          clip.createdAt,
        ).toLocaleTimeString()}`
      : "Saving replay file",
    title: isClipReady ? "Replay Ready" : "Preparing Replay",
  };
}

export {
  getClipPreviewFileTitle,
  resolveClipPreviewDetail,
  resolveClipPreviewHeaderState,
};
