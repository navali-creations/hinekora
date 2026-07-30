import { useSettingsShallow } from "~/renderer/store";

import { maxRewindSaveSeconds, rewindBufferSeconds } from "~/types";
import { useManagedRecorderSettingsDisabled } from "../../ManagedRecorder.hooks/useManagedRecorderSettingsDisabled/useManagedRecorderSettingsDisabled";
import { ManagedRecorderAutoStartToggle } from "../ManagedRecorderAutoStartToggle/ManagedRecorderAutoStartToggle";
import { ManagedRecorderOverlayCaptureToggle } from "../ManagedRecorderOverlayCaptureToggle/ManagedRecorderOverlayCaptureToggle";
import { ManagedRecorderPreviewQualityField } from "../ManagedRecorderPreviewQualityField/ManagedRecorderPreviewQualityField";
import { ManagedRecorderRewindDurationField } from "../ManagedRecorderRewindDurationField/ManagedRecorderRewindDurationField";
import { ManagedRecorderSettingsToggle } from "../ManagedRecorderSettingsToggle/ManagedRecorderSettingsToggle";

const rewindAutoStartHelp =
  "Starts the rewind buffer when Hinekora opens or when the selected game becomes available.";
const rewindBookmarkTrackingHelp =
  "Tracks location, death, and manual replay bookmarks while rewind is active, even when no video is saved.";
const deathClipDurationHelp = `Controls how many seconds are saved after a death. Hinekora keeps a ${rewindBufferSeconds} second rewind buffer and saves up to ${maxRewindSaveSeconds} seconds.`;
const manualReplayDurationHelp = `Controls how many seconds are saved when you trigger a manual replay. Hinekora keeps a ${rewindBufferSeconds} second rewind buffer and saves up to ${maxRewindSaveSeconds} seconds.`;
const deathClipsEnabledHelp =
  "Automatically saves a replay when Hinekora detects your character's death. Manual replays remain available when this is off.";
const rewindOverlayCaptureHelp =
  "Uses window capture protection so Hinekora overlays stay out of death clips, manual replays, screenshots, and external capture tools.";

function ManagedRecorderRewindSettingsFields() {
  const disabled = useManagedRecorderSettingsDisabled();
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const handleDeathClipsEnabledChange = (checked: boolean) => {
    void updateSettings({ deathClipsEnabled: checked });
  };
  const handleBookmarkTrackingChange = (checked: boolean) => {
    void updateSettings({ recordingTrackBookmarksInRewind: checked });
  };

  return (
    <div className="grid gap-3">
      <ManagedRecorderRewindDurationField
        helpText={deathClipDurationHelp}
        label="Death clip duration"
        settingKey="deathClipSeconds"
      />

      <ManagedRecorderRewindDurationField
        helpText={manualReplayDurationHelp}
        label="Manual replay duration"
        settingKey="manualReplaySeconds"
      />

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderPreviewQualityField />
      </div>

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderSettingsToggle
          ariaLabel="Enable death clips"
          checked={settingsValue?.deathClipsEnabled ?? true}
          disabled={disabled}
          helpText={deathClipsEnabledHelp}
          label="Enable death clips"
          onChange={handleDeathClipsEnabledChange}
        />
      </div>

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderAutoStartToggle
          ariaLabel="Start rewind automatically"
          helpText={rewindAutoStartHelp}
          label="Start rewind automatically"
          mode="rewind"
        />
      </div>

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderSettingsToggle
          ariaLabel="Track bookmarks in rewind"
          checked={settingsValue?.recordingTrackBookmarksInRewind ?? true}
          disabled={disabled}
          helpText={rewindBookmarkTrackingHelp}
          label="Track bookmarks in rewind"
          onChange={handleBookmarkTrackingChange}
        />
      </div>

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderOverlayCaptureToggle
          ariaLabel="Hide Hinekora overlays from rewind"
          helpText={rewindOverlayCaptureHelp}
          label="Hide overlays from rewind"
          settingKey="recordingHideOverlaysFromRewind"
        />
      </div>
    </div>
  );
}

export { ManagedRecorderRewindSettingsFields };
