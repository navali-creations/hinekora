import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function CaptureSourceBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Capture source"
      subtitle="Select the screen or window Hinekora should record."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Source Selection
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Use the source dropdown to choose a screen, a live game window,
                or a game window that is not running yet.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Hinekora records the selected source for rewind, clips, and
                session recordings.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                When a game-specific source is selected, the matching capture
                profile and game selection stay in sync.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Preview & Refresh
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Show Preview confirms the correct source before you record.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>Refresh reloads available windows and monitors.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Unlock the profile before changing the source if you want that
                source saved to the profile.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            A not-running game source becomes active automatically once the
            selected game window appears.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { CaptureSourceBeacon };
