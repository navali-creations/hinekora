import { ManagedRecorderOverlayCaptureToggle } from "../ManagedRecorderOverlayCaptureToggle/ManagedRecorderOverlayCaptureToggle";

const recordingOverlayCaptureHelp =
  "Uses window capture protection so Hinekora overlays stay out of full-session recordings, screenshots, and external capture tools.";

function ManagedRecorderRecordingSettingsFields() {
  return (
    <div className="grid gap-3">
      <ManagedRecorderOverlayCaptureToggle
        ariaLabel="Hide Hinekora overlays from recording"
        helpText={recordingOverlayCaptureHelp}
        label="Hide overlays from recording"
        settingKey="recordingHideOverlaysFromRecording"
      />
    </div>
  );
}

export { ManagedRecorderRecordingSettingsFields };
