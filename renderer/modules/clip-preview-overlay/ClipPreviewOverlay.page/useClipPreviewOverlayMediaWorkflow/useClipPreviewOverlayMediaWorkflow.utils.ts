import type { ReplayClipDetail } from "~/main/modules/replay-clips";

import { resolveClipPreviewDetail } from "../useClipPreviewOverlayDetail/useClipPreviewOverlayDetail.utils";

function resolveClipPreviewMediaState(input: {
  detail: ReplayClipDetail | null;
  durationOverrideSeconds: number | null;
  isCopying: boolean;
  isMediaReady: boolean;
  isSaving: boolean;
  mediaError: string | null;
  mediaVersion: number;
}) {
  const detail = resolveClipPreviewDetail(
    input.detail,
    input.durationOverrideSeconds,
  );
  const baseVideoSrc = detail.previewMediaUrl ?? detail.mediaUrl;
  const separator = baseVideoSrc?.includes("?") ? "&" : "?";
  const videoSrc = baseVideoSrc
    ? `${baseVideoSrc}${separator}v=${input.mediaVersion}`
    : null;
  const isProcessing = input.isCopying || input.isSaving;
  const canUseClip =
    detail.hasPlayableClipFile && Boolean(videoSrc) && input.isMediaReady;
  const isPreparingClip = Boolean(
    (detail.clip &&
      !detail.hasPlayableClipFile &&
      detail.clip.status !== "failed" &&
      (detail.clip.status === "death_detected" ||
        detail.clip.status === "saving_replay" ||
        detail.clip.status === "processing")) ||
      (detail.hasPlayableClipFile &&
        !input.mediaError &&
        (!videoSrc || !input.isMediaReady)),
  );

  return {
    ...detail,
    canUseClip,
    isPreparingClip,
    isProcessing,
    videoSrc,
  };
}

export { resolveClipPreviewMediaState };
