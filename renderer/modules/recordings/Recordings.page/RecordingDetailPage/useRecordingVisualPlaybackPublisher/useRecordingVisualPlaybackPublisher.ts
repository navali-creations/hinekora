import { useCallback, useRef } from "react";

function useRecordingVisualPlaybackPublisher() {
  const listenersRef = useRef(new Set<(seconds: number) => void>());

  const publishVisualPlaybackTime = useCallback((seconds: number) => {
    for (const listener of listenersRef.current) {
      listener(seconds);
    }
  }, []);

  const subscribeVisualPlaybackTime = useCallback(
    (listener: (seconds: number) => void) => {
      listenersRef.current.add(listener);

      return () => {
        listenersRef.current.delete(listener);
      };
    },
    [],
  );

  return { publishVisualPlaybackTime, subscribeVisualPlaybackTime };
}

export { useRecordingVisualPlaybackPublisher };
