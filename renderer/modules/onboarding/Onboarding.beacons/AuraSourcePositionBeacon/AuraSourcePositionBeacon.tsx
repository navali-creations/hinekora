import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function AuraSourcePositionBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Source and position"
      subtitle="Understand what the preview boxes mean before adjusting an aura."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Preview Boxes
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <strong className="text-base-content">Source area</strong> is
                the part of the screen Hinekora copies from.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <strong className="text-base-content">Aura position</strong> is
                where that copied source appears in the overlay.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Highlighting
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                The selected source uses a moving dashed border so you can spot
                the captured area quickly.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                The selected aura position glows to show which overlay copy you
                are editing.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Select an aura tab, then use the side panel or preview handles to
            fine-tune the source and position.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { AuraSourcePositionBeacon };
