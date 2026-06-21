import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function EditorProfilesBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Editor profiles"
      subtitle="Switch between saved edits without losing your timeline work."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Saved Edits
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Pick a saved edit to reopen its clips, trims, gaps, and history.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Use the pencil button to rename the selected edit profile.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Default means the current edit has not been saved as a named project
            yet.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { EditorProfilesBeacon };
