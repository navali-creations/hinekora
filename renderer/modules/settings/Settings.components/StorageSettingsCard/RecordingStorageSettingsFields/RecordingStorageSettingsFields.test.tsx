import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  recorderStatus: null as {
    isStartingRecording?: boolean;
    isStoppingRecording?: boolean;
    outputDirectory?: string;
    recording?: boolean;
  } | null,
  recordingMaxStorageGb: 48,
  recordingStoragePath: "C:\\Recordings",
  refreshRecordingStorageUsage: vi.fn(),
  refreshStorage: vi.fn(),
  selectPath: vi.fn(),
  setError: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useManagedRecorderSelector: (
    selector: (managedRecorder: {
      status: typeof storeMocks.recorderStatus;
    }) => unknown,
  ) => selector({ status: storeMocks.recorderStatus }),
  useRecordingStorageShallow: (
    selector: (recordingStorage: {
      refreshUsage: typeof storeMocks.refreshRecordingStorageUsage;
    }) => unknown,
  ) =>
    selector({
      refreshUsage: storeMocks.refreshRecordingStorageUsage,
    }),
  useSettingsShallow: (
    selector: (settings: {
      update: typeof storeMocks.updateSettings;
      value: {
        recordingMaxStorageGb: number;
        recordingStoragePath: string;
      };
    }) => unknown,
  ) =>
    selector({
      update: storeMocks.updateSettings,
      value: {
        recordingMaxStorageGb: storeMocks.recordingMaxStorageGb,
        recordingStoragePath: storeMocks.recordingStoragePath,
      },
    }),
  useStorageShallow: (
    selector: (storage: {
      refresh: typeof storeMocks.refreshStorage;
      setError: typeof storeMocks.setError;
    }) => unknown,
  ) =>
    selector({
      refresh: storeMocks.refreshStorage,
      setError: storeMocks.setError,
    }),
}));

import { RecordingStorageSettingsFields } from "./RecordingStorageSettingsFields";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  storeMocks.recorderStatus = null;
  storeMocks.recordingMaxStorageGb = 48;
  storeMocks.recordingStoragePath = "C:\\Recordings";
  storeMocks.setError.mockReset();
  storeMocks.refreshRecordingStorageUsage.mockReset();
  storeMocks.refreshRecordingStorageUsage.mockResolvedValue(undefined);
  storeMocks.refreshStorage.mockReset();
  storeMocks.refreshStorage.mockResolvedValue(undefined);
  storeMocks.updateSettings.mockReset();
  storeMocks.selectPath.mockReset();
  storeMocks.selectPath.mockResolvedValue(null);
  Object.defineProperty(window, "electron", {
    configurable: true,
    value: {
      app: { selectPath: storeMocks.selectPath },
    },
  });
});

afterEach(() => {
  root.unmount();
  document.body.replaceChildren();
});

describe("RecordingStorageSettingsFields", () => {
  it("restores the persisted path when a blur update fails", async () => {
    storeMocks.updateSettings.mockRejectedValue(new Error("Folder is locked"));
    await act(async () => {
      root.render(<RecordingStorageSettingsFields />);
    });
    const input =
      container.querySelector<HTMLInputElement>("input:not([type])");
    if (!input) {
      throw new Error("Expected recording storage path input");
    }

    await act(async () => {
      setNativeInputValue(input, "D:\\New Recordings");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(storeMocks.updateSettings).toHaveBeenCalledWith({
        recordingStoragePath: "D:\\New Recordings",
      });
      expect(storeMocks.setError).toHaveBeenLastCalledWith("Folder is locked");
      expect(input.value).toBe("C:\\Recordings");
    });
    expect(storeMocks.refreshStorage).not.toHaveBeenCalled();
    expect(storeMocks.refreshRecordingStorageUsage).not.toHaveBeenCalled();
  });

  it("places the max storage help tooltip to the left", async () => {
    await act(async () => {
      root.render(<RecordingStorageSettingsFields />);
    });

    expect(
      container.querySelector(".tooltip-left")?.getAttribute("data-tip"),
    ).toContain("Set 0 for unlimited storage");
  });

  it("commits the max storage limit only after editing finishes", async () => {
    storeMocks.updateSettings.mockResolvedValue(undefined);
    await act(async () => {
      root.render(<RecordingStorageSettingsFields />);
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    if (!input) {
      throw new Error("Expected max storage input");
    }

    await act(async () => {
      setNativeInputValue(input, "12");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();

    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    await vi.waitFor(() => {
      expect(storeMocks.updateSettings).toHaveBeenCalledWith({
        recordingMaxStorageGb: 12,
      });
    });
  });

  it("stores a selected recording folder and refreshes storage", async () => {
    storeMocks.selectPath.mockResolvedValue("D:\\New Recordings");
    storeMocks.updateSettings.mockResolvedValue(undefined);
    await act(async () => {
      root.render(<RecordingStorageSettingsFields />);
    });

    const browseButton = container.querySelector<HTMLButtonElement>("button");
    await act(async () => {
      browseButton?.click();
    });

    await vi.waitFor(() => {
      expect(storeMocks.updateSettings).toHaveBeenCalledWith({
        recordingStoragePath: "D:\\New Recordings",
      });
      expect(storeMocks.refreshStorage).toHaveBeenCalledTimes(1);
      expect(storeMocks.refreshRecordingStorageUsage).toHaveBeenCalledTimes(1);
    });
  });

  it("restores the max storage value when persistence fails", async () => {
    storeMocks.updateSettings.mockRejectedValue(new Error("Limit rejected"));
    await act(async () => {
      root.render(<RecordingStorageSettingsFields />);
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    await act(async () => {
      setNativeInputValue(input, "12");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(input.value).toBe("48");
      expect(storeMocks.setError).toHaveBeenLastCalledWith("Limit rejected");
    });
  });

  it("disables storage controls while recording", async () => {
    storeMocks.recorderStatus = { recording: true };
    await act(async () => {
      root.render(<RecordingStorageSettingsFields />);
    });

    expect(
      [
        ...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          "input, button",
        ),
      ].every((control) => control.disabled),
    ).toBe(true);
  });
});

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(input, value);
}
