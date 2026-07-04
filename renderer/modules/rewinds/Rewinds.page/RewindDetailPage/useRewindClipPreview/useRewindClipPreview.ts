import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReplayClipDetail } from "~/main/modules/replay-clips";
import { useMediaPlayback } from "~/renderer/modules/media-playback/useMediaPlayback/useMediaPlayback";

interface RewindClipPreviewState {
  detail: ReplayClipDetail | null;
  error: string | null;
  isLoading: boolean;
}

const initialRewindClipPreviewState: RewindClipPreviewState = {
  detail: null,
  error: null,
  isLoading: false,
};

interface RewindClipPlaybackRequest {
  play: boolean;
  seekSeconds: number;
  version: number;
}

const initialRewindClipPlaybackRequest: RewindClipPlaybackRequest = {
  play: false,
  seekSeconds: 0,
  version: 0,
};

function useRewindClipPreview() {
  const [clipPreviewState, setClipPreviewState] = useState(
    initialRewindClipPreviewState,
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playbackRequest, setPlaybackRequest] = useState(
    initialRewindClipPlaybackRequest,
  );
  const visualTimeListenersRef = useRef(new Set<(seconds: number) => void>());
  const mediaUrl = clipPreviewState.detail?.mediaUrl ?? null;
  const fallbackDurationSeconds = useMemo(() => {
    const detail = clipPreviewState.detail;

    return (
      detail?.durationSeconds ?? detail?.clip.targetDurationSeconds ?? null
    );
  }, [clipPreviewState.detail]);
  const publishVisualPlaybackTime = useCallback((seconds: number) => {
    for (const listener of visualTimeListenersRef.current) {
      listener(seconds);
    }
  }, []);
  const subscribeVisualPlaybackTime = useCallback(
    (listener: (seconds: number) => void) => {
      visualTimeListenersRef.current.add(listener);

      return () => {
        visualTimeListenersRef.current.delete(listener);
      };
    },
    [],
  );
  const playback = useMediaPlayback({
    fallbackDurationSeconds,
    mediaUrl,
    onVisualTimeChange: publishVisualPlaybackTime,
  });

  const selectClip = useCallback(
    (
      clipId: string | null,
      options: { play?: boolean; seekSeconds?: number } = {},
    ) => {
      setSelectedClipId(clipId);
      setPlaybackRequest((current) => ({
        play: options.play ?? false,
        seekSeconds: options.seekSeconds ?? 0,
        version: current.version + 1,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!selectedClipId) {
      setClipPreviewState(initialRewindClipPreviewState);
      return;
    }

    let isActive = true;
    setClipPreviewState({
      detail: null,
      error: null,
      isLoading: true,
    });

    window.electron.replayClips
      .get(selectedClipId)
      .then((detail) => {
        if (isActive) {
          setClipPreviewState({ detail, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setClipPreviewState({
            detail: null,
            error: error instanceof Error ? error.message : "Clip failed",
            isLoading: false,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedClipId]);

  useEffect(() => {
    if (!mediaUrl || !selectedClipId) {
      return;
    }

    const { play, seekSeconds } = playbackRequest;
    playback.seekTo(seekSeconds);
    if (play) {
      playback.play();
    }
  }, [
    mediaUrl,
    playback.play,
    playback.seekTo,
    playbackRequest,
    selectedClipId,
  ]);

  return {
    clipPreviewState,
    mediaUrl,
    playback,
    selectClip,
    selectedClipId,
    subscribeVisualPlaybackTime,
  };
}

export { useRewindClipPreview };
