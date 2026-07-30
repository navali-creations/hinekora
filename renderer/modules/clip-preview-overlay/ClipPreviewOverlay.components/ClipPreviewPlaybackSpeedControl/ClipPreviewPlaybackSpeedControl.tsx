import clsx from "clsx";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import { isReplayClipPlaybackRate, replayClipPlaybackRates } from "~/types";
import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";

interface ClipPreviewPlaybackSpeedControlProps {
  disabled: boolean;
}

function ClipPreviewPlaybackSpeedControl({
  disabled,
}: ClipPreviewPlaybackSpeedControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { playbackRate, setPlaybackRate } = useClipPreviewOverlayShallow(
    (clipPreviewOverlay) => ({
      playbackRate: clipPreviewOverlay.playbackRate,
      setPlaybackRate: clipPreviewOverlay.setPlaybackRate,
    }),
  );

  const handleToggleOpen = () => {
    if (!disabled) {
      setIsOpen((open) => !open);
    }
  };

  const handlePlaybackRateClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const option = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-playback-rate]",
    );
    const nextPlaybackRate = Number(option?.dataset.playbackRate);
    if (!option || !isReplayClipPlaybackRate(nextPlaybackRate)) {
      return;
    }

    setPlaybackRate(nextPlaybackRate);
    setIsOpen(false);
  };

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <div className={styles.speedControl}>
      <button
        aria-expanded={isOpen}
        aria-label={`Replay speed: ${playbackRate}x`}
        className={clsx(
          styles.speedButton,
          styles.videoSecondaryButton,
          {
            [styles.videoSecondaryButtonActive!]: playbackRate !== 1,
          },
          "btn btn-sm",
        )}
        disabled={disabled}
        type="button"
        onClick={handleToggleOpen}
      >
        {playbackRate}x
      </button>
      {isOpen && (
        <div
          aria-label="Replay speed options"
          className={styles.speedOptions}
          role="menu"
          onClick={handlePlaybackRateClick}
        >
          {replayClipPlaybackRates.map((rate) => (
            <button
              aria-checked={rate === playbackRate}
              className={clsx(
                styles.speedOption,
                {
                  [styles.speedOptionActive!]: rate === playbackRate,
                },
                "btn btn-ghost btn-xs",
              )}
              data-playback-rate={rate}
              disabled={disabled}
              key={rate}
              role="menuitemradio"
              type="button"
            >
              {rate}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { ClipPreviewPlaybackSpeedControl };
