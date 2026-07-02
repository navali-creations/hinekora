import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function GameSelectorBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Game selection"
      subtitle="Choose the Path of Exile game Hinekora should watch and record."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Game & League Selection
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Pick{" "}
                <strong className="text-base-content">Path of Exile 1</strong>{" "}
                or{" "}
                <strong className="text-base-content">Path of Exile 2</strong>{" "}
                from the app bar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                The selected game controls Client.txt watching and recorder
                state.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Switching games restores that game&apos;s selected capture
                profile and live preview source.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Use the league selector beside each game to keep clips
                organized.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Choose the game before recording so clips are saved under the right
            game and league.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { GameSelectorBeacon };
