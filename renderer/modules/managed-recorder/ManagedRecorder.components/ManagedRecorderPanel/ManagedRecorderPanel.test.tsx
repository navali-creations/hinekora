import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManagedRecorderPanel } from "./ManagedRecorderPanel";

vi.mock(
  "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderAudioSettingsCard/ManagedRecorderAudioSettingsCard",
  () => ({
    ManagedRecorderAudioSettingsCard: () => <div>Audio fields</div>,
  }),
);
vi.mock(
  "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderRecordingSettingsFields/ManagedRecorderRecordingSettingsFields",
  () => ({
    ManagedRecorderRecordingSettingsFields: () => <div>Recording fields</div>,
  }),
);
vi.mock(
  "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderRewindSettingsFields/ManagedRecorderRewindSettingsFields",
  () => ({
    ManagedRecorderRewindSettingsFields: () => <div>Rewind fields</div>,
  }),
);
vi.mock(
  "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsFields/ManagedRecorderSettingsFields",
  () => ({
    ManagedRecorderSettingsFields: () => <div>Capture fields</div>,
  }),
);
vi.mock(
  "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderSettingsInfoAlert/ManagedRecorderSettingsInfoAlert",
  () => ({
    ManagedRecorderSettingsInfoAlert: () => <div>Settings info</div>,
  }),
);

let container: HTMLDivElement;
let root: Root;

async function renderPanel(): Promise<void> {
  await act(async () => {
    root.render(<ManagedRecorderPanel />);
  });
}

describe("ManagedRecorderPanel", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("links recorder settings tabs to the active tab panel", async () => {
    await renderPanel();

    const captureTab = container.querySelector<HTMLButtonElement>(
      "#recorder-settings-tab-capture",
    );
    const panel = container.querySelector<HTMLElement>(
      "#recorder-settings-panel-capture",
    );

    expect(captureTab?.getAttribute("aria-controls")).toBe(
      "recorder-settings-panel-capture",
    );
    expect(captureTab?.getAttribute("aria-selected")).toBe("true");
    expect(panel?.getAttribute("role")).toBe("tabpanel");
    expect(panel?.getAttribute("aria-labelledby")).toBe(
      "recorder-settings-tab-capture",
    );

    const rewindTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Rewind",
    );
    await act(async () => {
      rewindTab?.click();
    });

    expect(
      container
        .querySelector("#recorder-settings-panel-rewind")
        ?.getAttribute("aria-labelledby"),
    ).toBe("recorder-settings-tab-rewind");
  });
});
