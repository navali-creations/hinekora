import type { ChangeEvent } from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

function EditorAudioControls() {
  const { previewHasAudio, previewVolume, setPreviewVolume } = useEditorShallow(
    (editor) => ({
      previewHasAudio: editor.previewHasAudio,
      previewVolume: editor.previewVolume,
      setPreviewVolume: editor.setPreviewVolume,
    }),
  );
  const volumePercent = Math.round(previewVolume * 100);
  const isDisabled = previewHasAudio === false;
  const tooltip = `Preview volume ${volumePercent}%`;

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) {
      return;
    }

    setPreviewVolume(Number(event.currentTarget.value));
  };

  if (isDisabled) {
    return null;
  }

  return (
    <div
      className="tooltip tooltip-left no-drag flex h-8 items-center gap-2 rounded-full bg-base-300 px-2 text-base-content shadow-sm"
      data-tip={tooltip}
    >
      {isDisabled || previewVolume <= 0 ? (
        <FiVolumeX size={16} />
      ) : (
        <FiVolume2 size={16} />
      )}
      <input
        aria-label="Editor preview volume"
        className="range range-primary range-xs w-20"
        disabled={isDisabled}
        max={1}
        min={0}
        step={0.01}
        type="range"
        value={previewVolume}
        onChange={handleVolumeChange}
      />
    </div>
  );
}

export { EditorAudioControls };
