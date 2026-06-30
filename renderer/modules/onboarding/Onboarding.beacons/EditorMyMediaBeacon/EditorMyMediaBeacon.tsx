import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function EditorMyMediaBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="My media"
      subtitle="Browse clips and recordings that can be added to this edit."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Media Rail
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Switch between recordings, death clips, manual replays, and
                saved edits.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>Drag clips from here into the timeline video row.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Use the folder action to open the current media group in
                Explorer.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            The list loads more items as you scroll, keeping the editor light
            while browsing larger libraries.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { EditorMyMediaBeacon };
