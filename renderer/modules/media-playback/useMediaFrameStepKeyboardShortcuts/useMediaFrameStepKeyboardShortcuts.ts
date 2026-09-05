import { useEffect, useRef } from "react";

import { isKeyboardShortcutSuppressedTarget } from "~/renderer/modules/keyboard-shortcuts/KeyboardShortcuts.utils/KeyboardShortcuts.utils";

import {
  type MediaFrameStepDirection,
  resolveMediaFrameStepDirection,
  resolveMediaFrameStepSeconds,
} from "./useMediaFrameStepKeyboardShortcuts.utils";

interface UseMediaFrameStepKeyboardShortcutsInput {
  enabled: boolean;
  focusRegionSelector?: string;
  framesPerSecond?: number | null;
  getPlaybackSeconds?: () => number;
  isPlaying?: boolean;
  onStep?: (seconds: number) => void;
  playbackSeconds?: number;
  resolveFrameStepSeconds?: (
    currentSeconds: number,
    direction: MediaFrameStepDirection,
  ) => number | null;
  subscribePlaybackSeconds?: (
    listener: (seconds: number) => void,
  ) => () => void;
}

function useMediaFrameStepKeyboardShortcuts({
  enabled,
  focusRegionSelector,
  framesPerSecond,
  getPlaybackSeconds,
  isPlaying = false,
  onStep,
  playbackSeconds,
  resolveFrameStepSeconds: resolveCustomFrameStepSeconds,
  subscribePlaybackSeconds,
}: UseMediaFrameStepKeyboardShortcutsInput): void {
  const playbackSecondsRef = useRef(playbackSeconds ?? 0);
  const hasPlaybackSource =
    getPlaybackSeconds !== undefined || typeof playbackSeconds === "number";

  useEffect(() => {
    if (!isPlaying && typeof playbackSeconds === "number") {
      playbackSecondsRef.current = playbackSeconds;
    }
  }, [isPlaying, playbackSeconds]);

  useEffect(() => {
    if (!subscribePlaybackSeconds) {
      return;
    }

    return subscribePlaybackSeconds((seconds) => {
      playbackSecondsRef.current = seconds;
    });
  }, [subscribePlaybackSeconds]);

  useEffect(() => {
    if (!enabled || !hasPlaybackSource || !onStep) {
      return;
    }

    const findFocusRegion = (target: EventTarget | null) => {
      if (focusRegionSelector === undefined || !(target instanceof Element)) {
        return null;
      }

      const region = target.closest(focusRegionSelector);
      return region instanceof HTMLElement ? region : null;
    };
    const isWithinFocusRegion = (target: EventTarget | null) =>
      findFocusRegion(target) !== null;
    const handlePointerDown = (event: PointerEvent) => {
      const region = findFocusRegion(event.target);
      if (region && !region.contains(document.activeElement)) {
        region.focus({ preventScroll: true });
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = resolveMediaFrameStepDirection(event);
      if (
        direction === null ||
        isKeyboardShortcutSuppressedTarget(event.target) ||
        (focusRegionSelector &&
          !isWithinFocusRegion(event.target) &&
          !isWithinFocusRegion(document.activeElement))
      ) {
        return;
      }

      const currentSeconds = getPlaybackSeconds
        ? getPlaybackSeconds()
        : playbackSecondsRef.current;
      if (resolveCustomFrameStepSeconds) {
        const nextSeconds = resolveCustomFrameStepSeconds(
          currentSeconds,
          direction,
        );
        if (nextSeconds === null) {
          return;
        }

        event.preventDefault();
        playbackSecondsRef.current = nextSeconds;
        onStep(nextSeconds);
        return;
      }

      if (
        typeof framesPerSecond !== "number" ||
        !Number.isFinite(framesPerSecond) ||
        framesPerSecond <= 0
      ) {
        return;
      }

      event.preventDefault();
      const nextSeconds = resolveMediaFrameStepSeconds({
        currentSeconds,
        direction,
        framesPerSecond,
      });
      playbackSecondsRef.current = nextSeconds;
      onStep(nextSeconds);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    enabled,
    focusRegionSelector,
    framesPerSecond,
    getPlaybackSeconds,
    hasPlaybackSource,
    onStep,
    resolveCustomFrameStepSeconds,
  ]);
}

export { useMediaFrameStepKeyboardShortcuts };
