import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function OverlayIconBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Recorder overlay"
      subtitle="Open the compact recorder controls while the selected game is running."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Quick Controls
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Open the floating recorder controls without leaving the game.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Switch between Rewind and Recording tabs, then start or stop the
                active mode without opening the dashboard.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Minimize the overlay when you only need the timer, start or stop
                control, and the manual clip button in Rewind mode.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Use the aura buttons to open the Aura Manager or jump straight
                into adding a new aura source.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Availability
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <span className="block">
                  It is disabled while the recorder is unavailable or busy.
                </span>
                <span className="mt-1 block">
                  Try <kbd className="kbd kbd-xs">Ctrl</kbd> +{" "}
                  <kbd className="kbd kbd-xs">R</kbd> if this is the case.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                If it is disabled, hover the icon to see the exact reason.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            The overlay follows the selected game, so switch games from the app
            bar before opening it.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { OverlayIconBeacon };
