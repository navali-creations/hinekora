import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function EditorMoreOptionsBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="More options"
      subtitle="Save, copy, reset, inspect history, or delete this edit."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Editor Actions
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>Save exports the current timeline to an MP4 file.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Copy to clipboard renders the current edit and places the video
                file on the Windows clipboard.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                History opens the undo stack so you can inspect recent changes.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Copy to clipboard creates a video file you can paste directly into
            places like Discord with <kbd className="kbd kbd-xs">Ctrl</kbd>{" "}
            <kbd className="kbd kbd-xs">V</kbd>.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { EditorMoreOptionsBeacon };
