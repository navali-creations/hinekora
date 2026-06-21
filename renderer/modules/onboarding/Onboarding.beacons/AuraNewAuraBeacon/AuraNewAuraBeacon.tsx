import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function AuraNewAuraBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="New aura"
      subtitle="Capture a source area and create a matching aura overlay."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Creating Auras
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Add new aura asks you to select the source area Hinekora should
                copy.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                After the source is captured, a new aura tab appears so you can
                select and adjust it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Use the side panel to fine-tune the source area and aura
                position manually.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            The selected Path of Exile game must be running before Hinekora can
            capture a new aura source.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { AuraNewAuraBeacon };
