import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import { maxRewindSaveSeconds, rewindBufferSeconds } from "~/types";
import { Popover } from "../../Onboarding.components/Popover/Popover";

function CaptureSettingsBeacon(props: PopoverComponentProps) {
  return (
    <Popover
      title="Recording settings"
      subtitle="Tune rewind, capture, and audio preferences."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Settings Tabs
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Recording controls whether overlays are hidden from full-session
                recordings.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Rewind sets saved replay duration and keeps overlays out of
                death clips or manual replays.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Capture controls resolution, FPS, encoder, and video quality.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Audio selects microphone and desktop playback devices.
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2" />

        <div className="space-y-2">
          <p className="flex items-center font-semibold text-primary">
            Locked States
          </p>
          <ul className="space-y-2 text-base-content/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Rewind keeps a {rewindBufferSeconds} second buffer and saves up
                to {maxRewindSaveSeconds} seconds for death clips or manual
                replays.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Settings are saved locally and copied into an unlocked capture
                profile.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">•</span>
              <span>
                Profile locking is disabled while recording or rewind is active.
              </span>
            </li>
          </ul>
        </div>

        <div className="alert border border-info bg-secondary text-info">
          <FiInfo size={20} />
          <span>
            The blue settings notice can be dismissed and restored from the Help
            settings panel.
          </span>
        </div>
      </div>
    </Popover>
  );
}

export { CaptureSettingsBeacon };
