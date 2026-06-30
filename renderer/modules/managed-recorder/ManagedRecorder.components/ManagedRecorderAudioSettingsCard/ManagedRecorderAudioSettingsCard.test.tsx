import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import type { ManagedRecorderAudioDevices } from "~/main/modules/managed-recorder/ManagedRecorder.dto";

import type { ManagedRecorderStatus } from "~/types";

const storeMocks = vi.hoisted(() => ({
  settingsValue: {
    recordingAudioInputDeviceId: null as string | null,
    recordingAudioOutputDeviceId: null as string | null,
  },
  status: null as ManagedRecorderStatus | null,
  updateSettings: vi.fn(),
  useManagedRecorderSelector: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useManagedRecorderSelector: storeMocks.useManagedRecorderSelector,
  useSettingsShallow: storeMocks.useSettingsShallow,
}));

import { ManagedRecorderAudioSettingsCard } from "./ManagedRecorderAudioSettingsCard";

let container: HTMLDivElement;
let root: Root;
let listAudioDevices: Mock<
  (options?: { forceRefresh?: boolean }) => Promise<ManagedRecorderAudioDevices>
>;
const resolvedAudioDevices: ManagedRecorderAudioDevices = {
  input: [{ id: "{mic-device}", label: "Microphone" }],
  output: [
    {
      id: "{display-device}",
      label: "External Display Audio Device",
    },
  ],
};

function createStatus(
  overrides: Partial<ManagedRecorderStatus> = {},
): ManagedRecorderStatus {
  return {
    activeSessionDirectory: null,
    available: true,
    bufferActive: false,
    encoder: "hardware_h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: "C:\\Videos",
    outputResolution: "1920x1080",
    recording: false,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingPath: null,
    runRecordingStartedAt: null,
    runtime: "packaged_obs",
    runtimePath: "obs.exe",
    ...overrides,
  };
}

async function renderCard(
  options: { flushAudioLoad?: boolean; strictMode?: boolean } = {},
): Promise<void> {
  const element = options.strictMode ? (
    <StrictMode>
      <ManagedRecorderAudioSettingsCard />
    </StrictMode>
  ) : (
    <ManagedRecorderAudioSettingsCard />
  );

  await act(async () => {
    root.render(element);
    await Promise.resolve();
  });

  if (options.flushAudioLoad !== false) {
    await flushAudioDeviceLoad();
  }
}

async function flushAudioDeviceLoad(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function getRefreshButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Refresh audio devices"]',
  );
  if (!button) {
    throw new Error("Expected refresh audio devices button to render");
  }

  return button;
}

function getSelects(): [HTMLSelectElement, HTMLSelectElement] {
  const selects = Array.from(container.querySelectorAll("select"));
  if (selects.length !== 2) {
    throw new Error("Expected audio input and output selects to render");
  }
  const [inputSelect, outputSelect] = selects;
  if (!inputSelect || !outputSelect) {
    throw new Error("Expected audio input and output selects to render");
  }

  return [inputSelect, outputSelect];
}

describe("ManagedRecorderAudioSettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    listAudioDevices = vi.fn().mockResolvedValue(resolvedAudioDevices);
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        managedRecorder: {
          listAudioDevices,
        },
      },
    });
    storeMocks.settingsValue = {
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: null,
    };
    storeMocks.status = createStatus();
    storeMocks.updateSettings.mockReset();
    storeMocks.updateSettings.mockResolvedValue(undefined);
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        value: storeMocks.settingsValue,
        update: storeMocks.updateSettings,
      }),
    );
    storeMocks.useManagedRecorderSelector.mockImplementation((selector) =>
      selector({ status: storeMocks.status }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("loads audio devices on mount and force-refreshes on request", async () => {
    await renderCard();

    expect(listAudioDevices).toHaveBeenCalledWith({ forceRefresh: false });
    const [, outputSelect] = getSelects();
    expect(outputSelect.textContent).toContain("External Display...");

    await act(async () => {
      getRefreshButton().click();
      await Promise.resolve();
    });
    await flushAudioDeviceLoad();

    expect(listAudioDevices).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it("shows a loading state before probing audio devices", async () => {
    vi.useFakeTimers();
    try {
      let resolveAudioDevices!: (devices: ManagedRecorderAudioDevices) => void;
      listAudioDevices.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAudioDevices = resolve;
          }),
      );

      await renderCard({ flushAudioLoad: false });

      expect(container.textContent).toContain("Loading audio devices");
      expect(listAudioDevices).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(listAudioDevices).toHaveBeenCalledWith({ forceRefresh: false });

      await act(async () => {
        resolveAudioDevices(resolvedAudioDevices);
        await Promise.resolve();
      });

      const [, outputSelect] = getSelects();
      expect(outputSelect.textContent).toContain("External Display...");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps loaded audio devices visible when refresh fails", async () => {
    await renderCard();
    listAudioDevices.mockRejectedValueOnce(new Error("probe failed"));

    await act(async () => {
      getRefreshButton().click();
      await Promise.resolve();
    });
    await flushAudioDeviceLoad();

    const [, outputSelect] = getSelects();
    expect(outputSelect.textContent).toContain("External Display...");
    expect(getRefreshButton().title).toBe(
      "Audio device refresh failed. Try again.",
    );
  });

  it("shows an error state when the first audio device probe fails", async () => {
    listAudioDevices.mockRejectedValueOnce(new Error("probe failed"));

    await renderCard();

    expect(container.textContent).toContain(
      "Audio devices could not be loaded. Try refreshing.",
    );
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(getRefreshButton().title).toBe(
      "Audio device refresh failed. Try again.",
    );
  });

  it("renders loaded devices after React StrictMode replays the effect", async () => {
    await renderCard({ strictMode: true });

    const [, outputSelect] = getSelects();
    expect(outputSelect.textContent).toContain("External Display...");
  });

  it("loads saved selected devices on mount and writes selected settings", async () => {
    storeMocks.settingsValue = {
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: "{display-device}",
    };

    await renderCard();
    const [inputSelect, outputSelect] = getSelects();

    expect(listAudioDevices).toHaveBeenCalledTimes(1);
    expect(listAudioDevices).toHaveBeenCalledWith({ forceRefresh: false });
    expect(outputSelect.selectedOptions[0]?.textContent).toBe(
      "External Display...",
    );
    expect(outputSelect.title).toBe("External Display Audio Device");

    await act(async () => {
      outputSelect.value = "default";
      outputSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      inputSelect.value = "__disabled__";
      inputSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recordingAudioOutputDeviceId: "default",
    });
    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recordingAudioInputDeviceId: null,
    });
  });

  it("disables audio controls while recording is busy", async () => {
    storeMocks.status = createStatus({ isStoppingRecording: true });

    await renderCard();

    const [inputSelect, outputSelect] = getSelects();
    expect(inputSelect.disabled).toBe(true);
    expect(outputSelect.disabled).toBe(true);
    expect(getRefreshButton().disabled).toBe(true);
  });
});
