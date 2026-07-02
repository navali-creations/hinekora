import { isCapturePreviewSourceAvailable } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";

import type { CapturePreviewSource } from "~/types";

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

export function canPreviewCaptureSource(
  source: CapturePreviewSource | null | undefined,
): source is CapturePreviewSource {
  return Boolean(source && isCapturePreviewSourceAvailable(source));
}
