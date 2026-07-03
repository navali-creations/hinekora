import type { ChangeEvent } from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";

interface RecordingVolumeControlsProps {
  isDisabled: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

function RecordingVolumeControls({
  isDisabled,
  volume,
  onVolumeChange,
}: RecordingVolumeControlsProps) {
  const volumePercent = Math.round(volume * 100);
  const tooltip = `Recording volume ${volumePercent}%`;

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) {
      return;
    }

    onVolumeChange(Number(event.currentTarget.value));
  };

  return (
    <div
      className="tooltip tooltip-left no-drag flex h-8 items-center gap-2 rounded-full bg-base-300 px-2 text-base-content shadow-sm"
      data-tip={tooltip}
    >
      {volume <= 0 || isDisabled ? (
        <FiVolumeX size={16} />
      ) : (
        <FiVolume2 size={16} />
      )}
      <input
        aria-label="Recording volume"
        className="range range-primary range-xs w-20"
        disabled={isDisabled}
        max={1}
        min={0}
        step={0.01}
        type="range"
        value={volume}
        onChange={handleVolumeChange}
      />
    </div>
  );
}

export { RecordingVolumeControls };
