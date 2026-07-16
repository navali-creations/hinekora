import { useState } from "react";

import { type TabItem, Tabs } from "~/renderer/components/Tabs/Tabs";
import { CaptureProfileLockToggle } from "~/renderer/modules/capture-profiles/CaptureProfiles.components/CaptureProfileLockToggle/CaptureProfileLockToggle";
import { ManagedRecorderAudioSettingsCard } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderAudioSettingsCard/ManagedRecorderAudioSettingsCard";
import { ManagedRecorderRecordingSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderRecordingSettingsFields/ManagedRecorderRecordingSettingsFields";
import { ManagedRecorderRewindSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderRewindSettingsFields/ManagedRecorderRewindSettingsFields";
import { ManagedRecorderSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsFields/ManagedRecorderSettingsFields";
import { ManagedRecorderSettingsInfoAlert } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsInfoAlert/ManagedRecorderSettingsInfoAlert";
import { ManagedRecorderSettingsLockedOverlay } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsLockedOverlay/ManagedRecorderSettingsLockedOverlay";

type RecorderSettingsTab = "audio" | "capture" | "recording" | "rewind";

function getRecorderSettingsTabId(tab: RecorderSettingsTab): string {
  return `recorder-settings-tab-${tab}`;
}

function getRecorderSettingsPanelId(tab: RecorderSettingsTab): string {
  return `recorder-settings-panel-${tab}`;
}

const recorderSettingsTabs: TabItem<RecorderSettingsTab>[] = [
  {
    label: "Recording",
    panelId: getRecorderSettingsPanelId("recording"),
    tabId: getRecorderSettingsTabId("recording"),
    value: "recording",
  },
  {
    label: "Rewind",
    panelId: getRecorderSettingsPanelId("rewind"),
    tabId: getRecorderSettingsTabId("rewind"),
    value: "rewind",
  },
  {
    label: "Capture",
    panelId: getRecorderSettingsPanelId("capture"),
    tabId: getRecorderSettingsTabId("capture"),
    value: "capture",
  },
  {
    label: "Audio",
    panelId: getRecorderSettingsPanelId("audio"),
    tabId: getRecorderSettingsTabId("audio"),
    value: "audio",
  },
];

function ManagedRecorderPanel() {
  const [selectedTab, setSelectedTab] =
    useState<RecorderSettingsTab>("capture");

  const handleSettingsTabChange = (tab: RecorderSettingsTab) => {
    setSelectedTab(tab);
  };

  return (
    <div className="col-span-5">
      <section
        className="grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg"
        data-onboarding="capture-settings"
      >
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="m-0 font-bold text-primary text-sm">Settings</h2>
            <CaptureProfileLockToggle size="xs" variant="chip" />
          </div>

          <ManagedRecorderSettingsInfoAlert />

          <Tabs
            ariaLabel="Recording settings"
            items={recorderSettingsTabs}
            layout="equal"
            value={selectedTab}
            onChange={handleSettingsTabChange}
          />
        </div>

        <div
          aria-labelledby={getRecorderSettingsTabId(selectedTab)}
          className="relative grid min-h-75 content-start gap-3"
          id={getRecorderSettingsPanelId(selectedTab)}
          role="tabpanel"
        >
          {selectedTab === "recording" && (
            <>
              <h3 className="m-0 font-bold text-primary text-sm">
                Recording Settings
              </h3>
              <ManagedRecorderRecordingSettingsFields />
            </>
          )}
          {selectedTab === "rewind" && (
            <>
              <h3 className="m-0 font-bold text-primary text-sm">
                Rewind Settings
              </h3>
              <ManagedRecorderRewindSettingsFields />
            </>
          )}
          {selectedTab === "capture" && (
            <>
              <h3 className="m-0 font-bold text-primary text-sm">
                Capture Settings
              </h3>
              <ManagedRecorderSettingsFields />
            </>
          )}
          {selectedTab === "audio" && <ManagedRecorderAudioSettingsCard />}
          <ManagedRecorderSettingsLockedOverlay />
        </div>
      </section>
    </div>
  );
}

export { ManagedRecorderPanel };
