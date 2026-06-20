import { useCallback, useEffect, useRef, useState } from "react";

const SOURCE_HEALTH_POLL_MS = 2_500;

interface UseDesktopCaptureStreamInput {
  sourceId: string | null;
  enabled: boolean;
  createConstraints: (sourceId: string) => MediaStreamConstraints;
}

interface UseDesktopCaptureStreamResult {
  stream: MediaStream | null;
  error: string | null;
  isStarting: boolean;
  stop: () => void;
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

function getCaptureErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Capture preview failed";
}

function isVolatileCaptureSource(sourceId: string): boolean {
  return sourceId.startsWith("window:");
}

export function useDesktopCaptureStream({
  sourceId,
  enabled,
  createConstraints,
}: UseDesktopCaptureStreamInput): UseDesktopCaptureStreamResult {
  const streamRef = useRef<MediaStream | null>(null);
  const streamGenerationRef = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const stop = useCallback(() => {
    streamGenerationRef.current += 1;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setIsStarting(false);
  }, []);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let disposed = false;

    stop();
    setError(null);
    const streamGeneration = streamGenerationRef.current;

    if (!enabled || !sourceId) {
      return () => {
        disposed = true;
        stopMediaStream(activeStream);
      };
    }

    setIsStarting(true);

    void navigator.mediaDevices
      .getUserMedia(createConstraints(sourceId))
      .then((mediaStream) => {
        if (disposed || streamGenerationRef.current !== streamGeneration) {
          stopMediaStream(mediaStream);
          return;
        }

        let sourceClosed = false;
        const handleTrackEnded = () => {
          if (sourceClosed) {
            return;
          }

          sourceClosed = true;
          setError("Capture source closed");
          stop();
        };

        for (const track of mediaStream.getVideoTracks()) {
          track.addEventListener("ended", handleTrackEnded, { once: true });
        }

        activeStream = mediaStream;
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setIsStarting(false);
      })
      .catch((captureError) => {
        if (!disposed) {
          setError(getCaptureErrorMessage(captureError));
          setIsStarting(false);
        }
      });

    return () => {
      disposed = true;
      stopMediaStream(activeStream);
      if (streamRef.current === activeStream) {
        streamRef.current = null;
        setStream(null);
      }
    };
  }, [createConstraints, enabled, sourceId, stop]);

  useEffect(() => {
    if (!enabled || !sourceId || !isVolatileCaptureSource(sourceId)) {
      return;
    }

    let sourceClosed = false;
    const checkSourceHealth = () => {
      if (sourceClosed) {
        return;
      }

      void window.electron.capturePreview
        .sourceExists(sourceId)
        .then((exists) => {
          if (!exists) {
            sourceClosed = true;
            setError("Capture source closed");
            stop();
          }
        })
        .catch(() => {});
    };

    checkSourceHealth();
    const timer = setInterval(checkSourceHealth, SOURCE_HEALTH_POLL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [enabled, sourceId, stop]);

  return { stream, error, isStarting, stop };
}
