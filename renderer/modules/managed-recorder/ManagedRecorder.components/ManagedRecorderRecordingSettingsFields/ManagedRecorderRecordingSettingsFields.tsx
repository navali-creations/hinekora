import { ManagedRecorderAutoStartToggle } from "../ManagedRecorderAutoStartToggle/ManagedRecorderAutoStartToggle";
import { ManagedRecorderOverlayCaptureToggle } from "../ManagedRecorderOverlayCaptureToggle/ManagedRecorderOverlayCaptureToggle";

const recordingAutoStartHelp =
  "Starts full-session recording when Hinekora opens or when the selected game becomes available.";
const recordingOverlayCaptureHelp =
  "Uses window capture protection so Hinekora overlays stay out of full-session recordings, screenshots, and external capture tools.";

function ManagedRecorderRecordingSettingsFields() {
  return (
    <div className="grid gap-3">
      <ManagedRecorderAutoStartToggle
        ariaLabel="Start recording automatically"
        helpText={recordingAutoStartHelp}
        label="Start recording automatically"
        mode="recording"
      />

      <div className="border-base-content/10 border-t pt-3">
        <ManagedRecorderOverlayCaptureToggle
          ariaLabel="Hide Hinekora overlays from recording"
          helpText={recordingOverlayCaptureHelp}
          label="Hide overlays from recording"
          settingKey="recordingHideOverlaysFromRecording"
        />
      </div>
    </div>
  );
}

export { ManagedRecorderRecordingSettingsFields };
