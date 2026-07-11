import clsx from "clsx";
import type { MouseEvent } from "react";
import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

import type { ReplayClipPreviewResolution } from "~/types";
import { useManagedRecorderSettingsDisabled } from "../../ManagedRecorder.hooks/useManagedRecorderSettingsDisabled/useManagedRecorderSettingsDisabled";

const previewQualityOptions: Array<{
  help: string;
  label: ReplayClipPreviewResolution;
}> = [
  {
    help: "Creates a temporary 720p proxy before the overlay becomes playable. It takes longer to appear but reduces GPU load. Saving, clipboard, and clips opened in the full editor still use the original 1080p clip.",
    label: "720p",
  },
  {
    help: "Uses the original 1080p rewind immediately for the sharpest trimming preview. It requires more GPU decoding power and may stutter on constrained systems.",
    label: "1080p",
  },
];

function ManagedRecorderPreviewQualityField() {
  const disabled = useManagedRecorderSettingsDisabled();
  const { previewResolution, updateSettings } = useSettingsShallow(
    (settings) => ({
      previewResolution: settings.value?.replayClipPreviewResolution ?? "720p",
      updateSettings: settings.update,
    }),
  );

  const handleResolutionClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    const resolution = event.currentTarget.dataset
      .resolution as ReplayClipPreviewResolution;
    void updateSettings({ replayClipPreviewResolution: resolution });
  };

  return (
    <div className="grid gap-1.5 text-primary text-[0.8125rem]">
      <span>Preview quality</span>
      <div
        aria-label="Replay clip preview quality"
        className="join flex w-full"
        role="group"
      >
        {previewQualityOptions.map((option) => {
          const selected = previewResolution === option.label;

          return (
            <button
              aria-label={`Use ${option.label} preview quality`}
              aria-pressed={selected}
              className={clsx(
                "btn tooltip tooltip-left join-item btn-sm h-8 min-h-0 flex-1 gap-1.5 px-2 text-xs",
                {
                  "btn-primary": selected,
                  "btn-outline border-base-content/20 bg-base-200": !selected,
                },
              )}
              data-resolution={option.label}
              data-tip={option.help}
              disabled={disabled}
              key={option.label}
              type="button"
              onClick={handleResolutionClick}
            >
              {option.label}
              <FiInfo aria-hidden="true" className="h-3.5 w-3.5 opacity-65" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ManagedRecorderPreviewQualityField };
