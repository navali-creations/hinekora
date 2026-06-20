import { useCallback, useEffect, useMemo, useRef } from "react";

import { useEditorShallow } from "~/renderer/store";

import { useEditorPreviewFrame } from "../useEditorPreviewFrame/useEditorPreviewFrame";
import { isPlaybackInsideClip } from "./useEditorPreviewPlayback.utils";

const playbackSyncToleranceSeconds = 0.08;
const clipBoundaryToleranceSeconds = 0.02;

function useEditorPreviewPlayback() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackAnimationFrameRef = useRef<number | null>(null);
  const playbackSecondsRef = useRef(0);
  const { frameStyle, stageRef } = useEditorPreviewFrame();
  const {
    isPreviewPlaying,
    playbackSeconds,
    project,
    selectedAssetKey,
    selectedClipId,
    setPlaybackSeconds,
    setPreviewPlaying,
  } = useEditorShallow((editor) => ({
    isPreviewPlaying: editor.isPreviewPlaying,
    playbackSeconds: editor.playbackSeconds,
    project: editor.project,
    selectedAssetKey: editor.selectedAssetKey,
    selectedClipId: editor.selectedClipId,
    setPlaybackSeconds: editor.setPlaybackSeconds,
    setPreviewPlaying: editor.setPreviewPlaying,
  }));
  const timelineClips = useMemo(
    () => project?.tracks.flatMap((track) => track.clips) ?? [],
    [project],
  );
  const hasTimelineClips = timelineClips.length > 0;
  const timelineDurationSeconds = project?.durationSeconds ?? 0;
  const playbackClip =
    selectedClipId !== null
      ? (timelineClips.find((clip) =>
          isPlaybackInsideClip({ clip, playbackSeconds }),
        ) ?? null)
      : null;
  const selectedTimelineClip =
    timelineClips.find((clip) => clip.id === selectedClipId) ?? null;
  const previewClip = playbackClip ?? selectedTimelineClip;
  const selectedAsset =
    project?.assets.find((asset) => asset.assetKey === selectedAssetKey) ??
    null;
  const mediaUrl =
    previewClip?.mediaUrl ??
    (!hasTimelineClips ? selectedAsset?.mediaUrl : null);
  const title = previewClip?.name ?? selectedAsset?.name ?? "Preview";
  const sourceSeconds = playbackClip
    ? playbackClip.inSeconds +
      Math.max(0, playbackSeconds - playbackClip.startSeconds)
    : (previewClip?.inSeconds ?? playbackSeconds);

  useEffect(() => {
    playbackSecondsRef.current = playbackSeconds;
  }, [playbackSeconds]);

  useEffect(() => {
    if (!mediaUrl && isPreviewPlaying && !hasTimelineClips) {
      setPreviewPlaying(false);
    }
  }, [hasTimelineClips, isPreviewPlaying, mediaUrl, setPreviewPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl) {
      return;
    }

    if (
      Math.abs(video.currentTime - sourceSeconds) > playbackSyncToleranceSeconds
    ) {
      video.currentTime = sourceSeconds;
    }
  }, [mediaUrl, sourceSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl) {
      return;
    }

    if (!isPreviewPlaying) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      setPreviewPlaying(false);
    });
  }, [isPreviewPlaying, mediaUrl, setPreviewPlaying]);

  const syncPlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!previewClip) {
      setPlaybackSeconds(video.currentTime);
      return;
    }

    const nextPlaybackSeconds =
      previewClip.startSeconds + video.currentTime - previewClip.inSeconds;
    const clipEndSeconds =
      previewClip.startSeconds + previewClip.durationSeconds;

    if (
      video.currentTime >=
        previewClip.outSeconds - clipBoundaryToleranceSeconds ||
      nextPlaybackSeconds >= clipEndSeconds - clipBoundaryToleranceSeconds
    ) {
      const contiguousClip = timelineClips.find(
        (clip) =>
          clip.id !== previewClip.id &&
          Math.abs(clip.startSeconds - clipEndSeconds) <=
            clipBoundaryToleranceSeconds,
      );

      if (
        !contiguousClip &&
        clipEndSeconds >= timelineDurationSeconds - clipBoundaryToleranceSeconds
      ) {
        setPlaybackSeconds(0);
        setPreviewPlaying(false);
        return;
      }

      setPlaybackSeconds(clipEndSeconds);
      return;
    }

    setPlaybackSeconds(nextPlaybackSeconds);
  }, [
    previewClip,
    setPlaybackSeconds,
    setPreviewPlaying,
    timelineClips,
    timelineDurationSeconds,
  ]);

  useEffect(() => {
    if (!isPreviewPlaying || !mediaUrl) {
      return;
    }

    const syncPlaybackFrame = () => {
      syncPlaybackPosition();
      playbackAnimationFrameRef.current =
        window.requestAnimationFrame(syncPlaybackFrame);
    };

    playbackAnimationFrameRef.current =
      window.requestAnimationFrame(syncPlaybackFrame);

    return () => {
      if (playbackAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(playbackAnimationFrameRef.current);
      }
      playbackAnimationFrameRef.current = null;
    };
  }, [isPreviewPlaying, mediaUrl, syncPlaybackPosition]);

  useEffect(() => {
    if (!isPreviewPlaying || mediaUrl || !hasTimelineClips) {
      return;
    }

    const startedAtMs = performance.now();
    const startSeconds = playbackSecondsRef.current;
    const durationSeconds = Math.max(timelineDurationSeconds, startSeconds);

    const syncGapPlaybackFrame = () => {
      const elapsedSeconds = (performance.now() - startedAtMs) / 1_000;
      const nextPlaybackSeconds = Math.min(
        durationSeconds,
        startSeconds + elapsedSeconds,
      );
      setPlaybackSeconds(nextPlaybackSeconds);

      if (
        nextPlaybackSeconds >=
        durationSeconds - clipBoundaryToleranceSeconds
      ) {
        setPreviewPlaying(false);
        playbackAnimationFrameRef.current = null;
        return;
      }

      playbackAnimationFrameRef.current =
        window.requestAnimationFrame(syncGapPlaybackFrame);
    };

    playbackAnimationFrameRef.current =
      window.requestAnimationFrame(syncGapPlaybackFrame);

    return () => {
      if (playbackAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(playbackAnimationFrameRef.current);
      }
      playbackAnimationFrameRef.current = null;
    };
  }, [
    hasTimelineClips,
    isPreviewPlaying,
    mediaUrl,
    setPlaybackSeconds,
    setPreviewPlaying,
    timelineDurationSeconds,
  ]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = sourceSeconds;
    }
  };

  const handleTimeUpdate = () => {
    if (isPreviewPlaying) {
      return;
    }

    if (hasTimelineClips && !playbackClip) {
      return;
    }

    syncPlaybackPosition();
  };

  const handleEnded = () => {
    setPlaybackSeconds(0);
    setPreviewPlaying(false);
  };

  return {
    frameStyle,
    handleEnded,
    handleLoadedMetadata,
    handleTimeUpdate,
    mediaUrl,
    stageRef,
    title,
    videoRef,
  };
}

export { useEditorPreviewPlayback };
