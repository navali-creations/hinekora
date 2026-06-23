import type { ChangeEvent } from "react";
import { FiInfo } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

const overlayCaptureHelp =
  "Uses window capture protection so Hinekora overlays stay out of recordings, rewind clips, screenshots, and external capture tools.";

function ManagedRecorderOverlayCaptureToggle() {
  const { hideOverlaysFromCapture, updateSettings } = useSettingsShallow(
    (settings) => ({
      hideOverlaysFromCapture:
        settings.value?.recordingHideOverlaysFromCapture ?? false,
      updateSettings: settings.update,
    }),
  );

  const handleHideOverlaysFromCaptureChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    void updateSettings({
      recordingHideOverlaysFromCapture: event.target.checked,
    });
  };

  return (
    <label className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-base-content/10 bg-base-200/70 px-3 py-2 text-primary text-[0.8125rem]">
      <span className="inline-flex min-w-0 items-center gap-1 font-semibold">
        Hide overlays from recordings and rewind
        <span
          aria-label={overlayCaptureHelp}
          className="tooltip tooltip-bottom inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
          data-tip={overlayCaptureHelp}
          role="img"
          tabIndex={0}
        >
          <FiInfo className="h-3.5 w-3.5" />
        </span>
      </span>
      <input
        aria-label="Hide Hinekora overlays from recordings and rewind"
        checked={hideOverlaysFromCapture}
        className="toggle toggle-primary toggle-xs shrink-0"
        type="checkbox"
        onChange={handleHideOverlaysFromCaptureChange}
      />
    </label>
  );
}

export { ManagedRecorderOverlayCaptureToggle };
