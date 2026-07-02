import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function CaptureProfilesBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Capture profiles"
      subtitle="Save recording, rewind, capture, audio, and source choices per game."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            What They Store
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Profiles remember capture source, auto-start mode, rewind
                length, encoder, quality, FPS, resolution, and audio devices.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                PoE 1 and PoE 2 keep separate profile selections, so switching
                games restores the matching source setup.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Locking
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Locked profiles apply their saved setup without changing it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Unlock a profile before changing settings you want saved back
                into that profile.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Unlocking is disabled while recording or rewind is active, so an
            active capture cannot accidentally rewrite a profile.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { CaptureProfilesBeacon };
