import { ManagedRecorderSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsFields/ManagedRecorderSettingsFields";

function ManagedRecorderPanel() {
  return (
    <section
      className="col-span-5 grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg"
      data-onboarding="capture-settings"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">Capture Settings</h2>
      </div>

      <ManagedRecorderSettingsFields />
    </section>
  );
}

export { ManagedRecorderPanel };
