import { useCallback, useEffect, useRef } from "react";

interface UseCapturePreviewVideoElementInput {
  stream: MediaStream | null;
  stopPreviewStream: () => void;
  onPlaybackError: (message: string) => void;
}

function useCapturePreviewVideoElement({
  onPlaybackError,
  stopPreviewStream,
  stream,
}: UseCapturePreviewVideoElementInput) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const clearPreviewVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopPreviewStream();
      clearPreviewVideo();
    },
    [clearPreviewVideo, stopPreviewStream],
  );

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    if (!stream) {
      videoRef.current.srcObject = null;
      return;
    }

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => {
      onPlaybackError("Unable to start preview playback");
    });
  }, [onPlaybackError, stream]);

  return { clearPreviewVideo, videoRef };
}

export { useCapturePreviewVideoElement };
