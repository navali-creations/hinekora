import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function EditorPreviewSourceBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Preview source"
      subtitle="Check the selected clip or timeline segment before exporting."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Preview Monitor
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Select a media item to preview the source clip before adding it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Select a timeline clip to preview the exact trimmed section.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            If nothing is selected, the monitor stays empty so no video loads
            unnecessarily.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { EditorPreviewSourceBeacon };
