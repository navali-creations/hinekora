import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { Popover } from "../../Onboarding.components/Popover/Popover";

function CaptureModeBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Capture mode"
      subtitle="Choose how Hinekora should capture gameplay."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Recording Modes
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <strong className="text-base-content">Rewind</strong> keeps a
                rolling buffer and can save death clips or manual replays up to
                your configured duration.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                <strong className="text-base-content">Session Recording</strong>{" "}
                saves everything between Start and Stop for later editing.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            How It Behaves
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>Only one mode can be active at a time.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Capture profiles can auto-start Rewind or Session Recording when
                the selected game appears.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Pick Rewind for lightweight clipping, or Session Recording when
                you want the full run.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                The recorder overlay has matching tabs, so you can switch modes
                from the dashboard or from inside the game.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            Changing mode does not start recording by itself. Press Start after
            choosing the mode.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { CaptureModeBeacon };
