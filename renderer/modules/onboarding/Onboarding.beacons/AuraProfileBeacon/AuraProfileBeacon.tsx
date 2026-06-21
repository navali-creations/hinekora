import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function AuraProfileBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Aura profile"
      subtitle="Choose which capture profile the Aura Manager should edit."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Profile Selection
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Pick the profile whose source areas and aura positions you want
                to edit.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                For now, profile names and profile details are managed from
                Settings.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Switch profiles here when you want different aura layouts for
            different games, leagues, or setups.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { AuraProfileBeacon };
