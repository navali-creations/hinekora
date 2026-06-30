import { useCallback, useEffect, useMemo, useRef } from "react";

import { useEditorShallow } from "~/renderer/store";

import { publishEditorPlaybackVisualTime } from "../../Editor.utils/Editor.utils";
import { useEditorPreviewFrame } from "../useEditorPreviewFrame/useEditorPreviewFrame";
import { isPlaybackInsideClip } from "./useEditorPreviewPlayback.utils";

const playbackSyncToleranceSeconds = 0.08;
const clipBoundaryToleranceSeconds = 0.02;
const playbackStoreSyncIntervalMs = 50;

interface AudioTrackCapableVideoElement extends HTMLVideoElement {
  audioTracks?: { length: number };
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
}

function detectPreviewVideoHasAudio(video: HTMLVideoElement): boolean | null {
  const audioCapableVideo = video as AudioTrackCapableVideoElement;

  if (typeof audioCapableVideo.mozHasAudio === "boolean") {
    return audioCapableVideo.mozHasAudio;
  }

  if (typeof audioCapableVideo.audioTracks?.length === "number") {
    return audioCapableVideo.audioTracks.length > 0;
  }

  if (
    typeof audioCapableVideo.webkitAudioDecodedByteCount === "number" &&
    audioCapableVideo.webkitAudioDecodedByteCount > 0
  ) {
    return true;
  }

  return null;
}

function useEditorPreviewPlayback() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackAnimationFrameRef = useRef<number | null>(null);
  const playbackSecondsRef = useRef(0);
  const lastPlaybackStoreSyncMsRef = useRef(0);
  const { frameStyle, stageRef } = useEditorPreviewFrame();
  const {
    isPreviewPlaying,
    playbackSeconds,
    previewVolume,
    project,
    selectedAssetKey,
    selectedClipId,
    setPlaybackSeconds,
    setPreviewHasAudio,
    setPreviewPlaying,
  } = useEditorShallow((editor) => ({
    isPreviewPlaying: editor.isPreviewPlaying,
    playbackSeconds: editor.playbackSeconds,
    previewVolume: editor.previewVolume,
    project: editor.project,
    selectedAssetKey: editor.selectedAssetKey,
    selectedClipId: editor.selectedClipId,
    setPlaybackSeconds: editor.setPlaybackSeconds,
    setPreviewHasAudio: editor.setPreviewHasAudio,
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
    publishEditorPlaybackVisualTime(playbackSeconds);
  }, [playbackSeconds]);

  const publishPlaybackSeconds = useCallback(
    (nextPlaybackSeconds: number, options: { force?: boolean } = {}) => {
      playbackSecondsRef.current = nextPlaybackSeconds;
      publishEditorPlaybackVisualTime(nextPlaybackSeconds);

      const now = performance.now();
      if (
        !options.force &&
        now - lastPlaybackStoreSyncMsRef.current < playbackStoreSyncIntervalMs
      ) {
        return;
      }

      lastPlaybackStoreSyncMsRef.current = now;
      setPlaybackSeconds(nextPlaybackSeconds);
    },
    [setPlaybackSeconds],
  );

  useEffect(() => {
    if (!mediaUrl && isPreviewPlaying && !hasTimelineClips) {
      setPreviewPlaying(false);
    }
  }, [hasTimelineClips, isPreviewPlaying, mediaUrl, setPreviewPlaying]);

  useEffect(() => {
    setPreviewHasAudio(mediaUrl ? null : false);
  }, [mediaUrl, setPreviewHasAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.volume = previewVolume;
    video.muted = previewVolume <= 0;
  }, [previewVolume]);

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

  const syncPlaybackPosition = useCallback(
    (options: { force?: boolean } = {}) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (!previewClip) {
        publishPlaybackSeconds(video.currentTime, options);
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
          clipEndSeconds >=
            timelineDurationSeconds - clipBoundaryToleranceSeconds
        ) {
          publishPlaybackSeconds(0, { force: true });
          setPreviewPlaying(false);
          return;
        }

        publishPlaybackSeconds(clipEndSeconds, { force: true });
        return;
      }

      publishPlaybackSeconds(nextPlaybackSeconds, options);
    },
    [
      previewClip,
      publishPlaybackSeconds,
      setPreviewPlaying,
      timelineClips,
      timelineDurationSeconds,
    ],
  );

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

      if (
        nextPlaybackSeconds >=
        durationSeconds - clipBoundaryToleranceSeconds
      ) {
        publishPlaybackSeconds(nextPlaybackSeconds, { force: true });
        setPreviewPlaying(false);
        playbackAnimationFrameRef.current = null;
        return;
      }

      publishPlaybackSeconds(nextPlaybackSeconds);

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
    publishPlaybackSeconds,
    setPreviewPlaying,
    timelineDurationSeconds,
  ]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setPreviewHasAudio(detectPreviewVideoHasAudio(video));
      video.currentTime = sourceSeconds;
    }
  };

  const handleTimeUpdate = () => {
    if (isPreviewPlaying) {
      const video = videoRef.current;
      if (video) {
        const hasAudio = detectPreviewVideoHasAudio(video);
        if (hasAudio === true) {
          setPreviewHasAudio(true);
        }
      }
      return;
    }

    if (hasTimelineClips && !playbackClip) {
      return;
    }

    syncPlaybackPosition({ force: true });
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (
      previewClip &&
      video &&
      video.currentTime < previewClip.outSeconds - clipBoundaryToleranceSeconds
    ) {
      syncPlaybackPosition({ force: true });
      setPreviewPlaying(false);
      return;
    }

    publishPlaybackSeconds(0, { force: true });
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
