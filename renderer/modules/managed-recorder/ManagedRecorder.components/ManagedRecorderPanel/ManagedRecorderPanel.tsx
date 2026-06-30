import clsx from "clsx";
import type { MouseEvent } from "react";
import { useState } from "react";

import { ManagedRecorderAudioSettingsCard } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderAudioSettingsCard/ManagedRecorderAudioSettingsCard";
import { ManagedRecorderRecordingSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderRecordingSettingsFields/ManagedRecorderRecordingSettingsFields";
import { ManagedRecorderRewindSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderRewindSettingsFields/ManagedRecorderRewindSettingsFields";
import { ManagedRecorderSettingsFields } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsFields/ManagedRecorderSettingsFields";
import { ManagedRecorderSettingsInfoAlert } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsInfoAlert/ManagedRecorderSettingsInfoAlert";

const recorderSettingsTabs = [
  { id: "recording", label: "Recording" },
  { id: "rewind", label: "Rewind" },
  { id: "capture", label: "Capture" },
  { id: "audio", label: "Audio" },
] as const;
type RecorderSettingsTab = (typeof recorderSettingsTabs)[number]["id"];

function ManagedRecorderPanel() {
  const [selectedTab, setSelectedTab] =
    useState<RecorderSettingsTab>("capture");

  const handleSettingsTabClick = (event: MouseEvent<HTMLButtonElement>) => {
    const tab = event.currentTarget.dataset.tab as
      | RecorderSettingsTab
      | undefined;
    if (tab) {
      setSelectedTab(tab);
    }
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
          </div>

          <ManagedRecorderSettingsInfoAlert />

          <div
            aria-label="Recording settings"
            className="tabs tabs-boxed tabs-xs grid grid-cols-4 bg-base-300 p-1"
            role="tablist"
          >
            {recorderSettingsTabs.map((tab) => {
              const isSelected = selectedTab === tab.id;

              return (
                <button
                  aria-selected={isSelected}
                  className={clsx(
                    "tab min-w-0 whitespace-nowrap rounded-md font-semibold",
                    {
                      "tab-active bg-primary text-primary-content shadow-sm":
                        isSelected,
                      "text-base-content/65 hover:bg-base-200 hover:text-base-content":
                        !isSelected,
                    },
                  )}
                  data-tab={tab.id}
                  key={tab.id}
                  role="tab"
                  type="button"
                  onClick={handleSettingsTabClick}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

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
      </section>
    </div>
  );
}

export { ManagedRecorderPanel };
