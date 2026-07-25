import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeAndBlur,
  findButton,
  setNativeInputValue,
} from "../StorageSettingsCard.test.utils";

const GIGABYTE = 1024 ** 3;
const storeMocks = vi.hoisted(() => ({
  exportStatus: "idle",
  exportUsageBytes: (5 * 1024 ** 3) as number | null,
  exportUsageTruncated: false,
  maxStorageGb: 50,
  path: "C:\\Exports",
  refreshStorage: vi.fn(),
  refreshUsage: vi.fn(),
  revealPaths: vi.fn(),
  selectPath: vi.fn(),
  setError: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorSelector: (
    selector: (editor: { exportState: { status: string } }) => unknown,
  ) => selector({ exportState: { status: storeMocks.exportStatus } }),
  useRecordingStorageShallow: (
    selector: (storage: {
      refreshUsage: typeof storeMocks.refreshUsage;
      usage: {
        exportVideosSizeBytes: number;
        exportVideosUsageTruncated: boolean;
      } | null;
    }) => unknown,
  ) =>
    selector({
      refreshUsage: storeMocks.refreshUsage,
      usage:
        storeMocks.exportUsageBytes === null
          ? null
          : {
              exportVideosSizeBytes: storeMocks.exportUsageBytes,
              exportVideosUsageTruncated: storeMocks.exportUsageTruncated,
            },
    }),
  useSettingsShallow: (
    selector: (settings: {
      update: typeof storeMocks.updateSettings;
      value: {
        editorExportMaxStorageGb: number;
        editorExportStoragePath: string;
      };
    }) => unknown,
  ) =>
    selector({
      update: storeMocks.updateSettings,
      value: {
        editorExportMaxStorageGb: storeMocks.maxStorageGb,
        editorExportStoragePath: storeMocks.path,
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

import { ExportStoragePathField } from "./ExportStoragePathField";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  storeMocks.exportStatus = "idle";
  storeMocks.exportUsageBytes = 5 * GIGABYTE;
  storeMocks.exportUsageTruncated = false;
  storeMocks.maxStorageGb = 50;
  storeMocks.path = "C:\\Exports";
  storeMocks.refreshStorage.mockResolvedValue(undefined);
  storeMocks.refreshUsage.mockResolvedValue(undefined);
  storeMocks.revealPaths.mockResolvedValue({
    databasePath: "C:\\Data\\hinekora.sqlite",
    exportStoragePath: "C:\\Users\\seb\\Videos\\Hinekora Exports",
    exportStorageVolumes: [],
    storagePath: "C:\\Users\\seb\\Videos\\Hinekora Recordings",
  });
  storeMocks.selectPath.mockResolvedValue(null);
  storeMocks.updateSettings.mockResolvedValue(undefined);
  Object.defineProperty(window, "electron", {
    configurable: true,
    value: {
      app: { selectPath: storeMocks.selectPath },
      storage: { revealPaths: storeMocks.revealPaths },
    },
  });
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  document.body.replaceChildren();
});

describe("ExportStoragePathField", () => {
  it("persists a typed exports folder and refreshes both usage views", async () => {
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    const input = container.querySelector("input")!;
    expect(input.value).toBe("C:\\Exports");
    await act(async () => {
      setNativeInputValue(input, "D:\\Finished Videos");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      editorExportStoragePath: "D:\\Finished Videos",
    });
    expect(storeMocks.refreshStorage).toHaveBeenCalledOnce();
    expect(storeMocks.refreshUsage).toHaveBeenCalledOnce();
  });

  it("shows the full resolved default export folder", async () => {
    storeMocks.path = "";

    await act(async () => {
      root.render(<ExportStoragePathField />);
    });

    await vi.waitFor(() => {
      expect(container.querySelector("input")?.value).toBe(
        "C:\\Users\\seb\\Videos\\Hinekora Exports",
      );
    });
    expect(storeMocks.revealPaths).toHaveBeenCalledOnce();
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("reports a failure to resolve the default export folder", async () => {
    storeMocks.path = "";
    storeMocks.revealPaths.mockRejectedValueOnce(new Error("Drive offline"));

    await act(async () => {
      root.render(<ExportStoragePathField />);
    });

    await vi.waitFor(() => {
      expect(storeMocks.setError).toHaveBeenCalledWith("Drive offline");
    });
  });

  it("stores a browsed folder and restores the previous value on failure", async () => {
    storeMocks.selectPath.mockResolvedValueOnce("D:\\Exports");
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(storeMocks.selectPath).toHaveBeenCalledWith({
      defaultPath: "C:\\Exports",
      properties: ["openDirectory"],
      title: "Select exports folder",
    });
    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      editorExportStoragePath: "D:\\Exports",
    });

    storeMocks.updateSettings.mockRejectedValueOnce(new Error("Folder locked"));
    const input = container.querySelector("input")!;
    await act(async () => {
      setNativeInputValue(input, "Z:\\Locked");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(input.value).toBe("C:\\Exports");
    expect(storeMocks.setError).toHaveBeenLastCalledWith("Folder locked");
  });

  it("persists a rounded export budget and restores invalid input", async () => {
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    await act(async () => {
      setNativeInputValue(input, "75.6");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      editorExportMaxStorageGb: 76,
    });

    await act(async () => {
      setNativeInputValue(input, "invalid");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(input.value).toBe("50");
    expect(storeMocks.updateSettings).toHaveBeenCalledTimes(1);
  });

  it("confirms an export budget below current saved video usage", async () => {
    storeMocks.exportUsageBytes = 14 * GIGABYTE;
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    await changeAndBlur(input, "10");

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Reduce export storage?");
      expect(document.body.textContent).toContain(
        "Your saved edit videos currently use 14 GB",
      );
      expect(document.body.textContent).toContain(
        "will delete the oldest saved edit videos",
      );
      expect(document.body.textContent).toContain("about 9.5 GB");
      expect(document.body.textContent).toContain(
        "Deleted saved edit videos cannot be recovered",
      );
    });
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();

    await act(async () => findButton("Cancel").click());
    expect(input.value).toBe("50");

    await changeAndBlur(input, "10");
    await act(async () => findButton("Set 10 GB limit").click());
    await vi.waitFor(() => {
      expect(storeMocks.updateSettings).toHaveBeenCalledWith({
        editorExportMaxStorageGb: 10,
      });
    });
  });

  it("confirms an export reduction while current usage is unavailable", async () => {
    storeMocks.exportUsageBytes = null;
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    await changeAndBlur(input, "10");

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        "Current export usage is still being calculated",
      );
      expect(document.body.textContent).toContain(
        "automatic cleanup will begin",
      );
    });
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("confirms reductions when the reported export usage is partial", async () => {
    storeMocks.exportUsageBytes = 5 * GIGABYTE;
    storeMocks.exportUsageTruncated = true;
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    await changeAndBlur(input, "10");

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        "currently use at least 5.0 GB",
      );
    });
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("locks the field while an editor export is active", async () => {
    storeMocks.exportStatus = "exporting";
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    expect(container.querySelector("input")?.disabled).toBe(true);
    expect(container.querySelector("button")?.disabled).toBe(true);
  });
});
