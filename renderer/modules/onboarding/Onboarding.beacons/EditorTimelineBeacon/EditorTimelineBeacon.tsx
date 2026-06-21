import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function EditorTimelineBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Timeline"
      subtitle="Arrange, trim, split, delete, and undo timeline changes."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Editing Shortcuts
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Hover an empty gap or select a clip, then press{" "}
                <kbd className="kbd kbd-xs">Del</kbd> to remove it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Press <kbd className="kbd kbd-xs">Ctrl</kbd>{" "}
                <kbd className="kbd kbd-xs">Z</kbd> to undo.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Press <kbd className="kbd kbd-xs">Ctrl</kbd>{" "}
                <kbd className="kbd kbd-xs">Shift</kbd>{" "}
                <kbd className="kbd kbd-xs">Z</kbd> or{" "}
                <kbd className="kbd kbd-xs">Ctrl</kbd>{" "}
                <kbd className="kbd kbd-xs">Y</kbd> to redo.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Drag clip edges to trim. Use Split at the playhead to divide a clip
            into separately editable sections.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { EditorTimelineBeacon };
