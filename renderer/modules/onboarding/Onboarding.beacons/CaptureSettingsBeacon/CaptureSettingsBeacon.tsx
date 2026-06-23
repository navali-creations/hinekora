import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function CaptureSettingsBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Capture settings"
      subtitle="Tune recording quality and capture visibility."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Quality Controls
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Native source keeps the selected capture size unchanged.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Higher FPS and quality use more disk space and hardware
                resources.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Hide overlays from recordings and rewind uses Electron capture
                protection so Hinekora overlay windows stay out of saved video.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Locked States
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Settings are locked while a recording action is running.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Stop recording before changing encoder, FPS, quality, or output
                size.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Capture protection also hides Hinekora overlays from screenshots and
            external capture tools while it is enabled.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { CaptureSettingsBeacon };
