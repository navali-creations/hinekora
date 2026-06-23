import type { SyntheticEvent } from "react";
import { useCallback, useState } from "react";

import {
  type AuraVideoSize,
  readAuraVideoSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface VideoSizeState {
  sourceId: string | null;
  value: AuraVideoSize | null;
}

interface UseAuraOverlayVideoSizingInput {
  captureSourceId: string | null;
  fallbackVideoSize: AuraVideoSize | null;
  stream: MediaStream | null;
}

function useAuraOverlayVideoSizing({
  captureSourceId,
  fallbackVideoSize,
  stream,
}: UseAuraOverlayVideoSizingInput) {
  const [videoSizeState, setVideoSizeState] = useState<VideoSizeState>({
    sourceId: null,
    value: null,
  });
  const videoSize =
    videoSizeState.sourceId === captureSourceId ? videoSizeState.value : null;
  const effectiveVideoSize = videoSize ??
    fallbackVideoSize ?? { width: 1920, height: 1080 };

  const bindAuraVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      if (!element || !stream) {
        return;
      }

      element.srcObject = stream;
      const currentSize = readAuraVideoSize(element);
      if (currentSize) {
        setVideoSizeState({ sourceId: captureSourceId, value: currentSize });
      }
      void element
        .play()
        .then(() => {
          const nextSize = readAuraVideoSize(element);
          if (nextSize) {
            setVideoSizeState({ sourceId: captureSourceId, value: nextSize });
          }
        })
        .catch(() => {});
    },
    [captureSourceId, stream],
  );

  const handleVideoSizeChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    const nextSize = readAuraVideoSize(event.currentTarget);
    if (nextSize) {
      setVideoSizeState({ sourceId: captureSourceId, value: nextSize });
    }
  };

  return {
    bindAuraVideo,
    effectiveVideoSize,
    handleVideoSizeChange,
  };
}

export { useAuraOverlayVideoSizing };
