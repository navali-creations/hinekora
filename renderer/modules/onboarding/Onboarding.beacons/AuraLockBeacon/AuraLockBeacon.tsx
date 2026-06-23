import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function AuraLockBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Lock and unlock"
      subtitle="Control whether aura overlays are playable or editable."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Overlay Behavior
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <strong className="text-base-content">Lock</strong> makes the
                aura overlay click-through so it does not block gameplay.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <strong className="text-base-content">Unlock</strong> lets you
                drag, resize, select, and remove aura positions on the overlay.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Press <kbd className="kbd kbd-xs">Esc</kbd> while editing to
                lock auras again and return to gameplay.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Select an aura, then use <kbd className="kbd kbd-xs">Del</kbd>{" "}
                to remove it, <kbd className="kbd kbd-xs">Ctrl</kbd> +{" "}
                <kbd className="kbd kbd-xs">Z</kbd> to undo, or{" "}
                <kbd className="kbd kbd-xs">Ctrl</kbd> +{" "}
                <kbd className="kbd kbd-xs">Y</kbd> to redo.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Keep overlays locked while playing. Unlock only when you are
            adjusting aura placement.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { AuraLockBeacon };
