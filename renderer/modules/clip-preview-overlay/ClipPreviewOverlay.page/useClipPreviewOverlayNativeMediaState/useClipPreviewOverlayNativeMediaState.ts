import { type RefObject, useEffect } from "react";

import type { ReplayClipPlaybackRate } from "~/types";

function useClipPreviewOverlayNativeMediaState(input: {
  playbackRate: ReplayClipPlaybackRate;
  setFullscreen: (isFullscreen: boolean) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoSrc: string | null;
}): void {
  useEffect(() => {
    if (input.videoSrc && input.videoRef.current) {
      input.videoRef.current.playbackRate = input.playbackRate;
    }
  }, [input.playbackRate, input.videoRef, input.videoSrc]);

  useEffect(
    () =>
      window.electron.overlayWindows.onClipPreviewFullscreenChanged(
        input.setFullscreen,
      ),
    [input.setFullscreen],
  );
}

export { useClipPreviewOverlayNativeMediaState };
