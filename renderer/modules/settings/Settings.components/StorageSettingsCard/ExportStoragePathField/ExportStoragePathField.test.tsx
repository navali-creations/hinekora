import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  exportStatus: "idle",
  path: "C:\\Exports",
  refreshStorage: vi.fn(),
  refreshUsage: vi.fn(),
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
    }) => unknown,
  ) => selector({ refreshUsage: storeMocks.refreshUsage }),
  useSettingsShallow: (
    selector: (settings: {
      update: typeof storeMocks.updateSettings;
      value: { editorExportStoragePath: string };
    }) => unknown,
  ) =>
    selector({
      update: storeMocks.updateSettings,
      value: { editorExportStoragePath: storeMocks.path },
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
  storeMocks.path = "C:\\Exports";
  storeMocks.refreshStorage.mockResolvedValue(undefined);
  storeMocks.refreshUsage.mockResolvedValue(undefined);
  storeMocks.selectPath.mockResolvedValue(null);
  storeMocks.updateSettings.mockResolvedValue(undefined);
  Object.defineProperty(window, "electron", {
    configurable: true,
    value: { app: { selectPath: storeMocks.selectPath } },
  });
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
    expect(input.placeholder).toBe("Default: Videos\\Hinekora Exports");
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

  it("locks the field while an editor export is active", async () => {
    storeMocks.exportStatus = "exporting";
    await act(async () => {
      root.render(<ExportStoragePathField />);
    });
    expect(container.querySelector("input")?.disabled).toBe(true);
    expect(container.querySelector("button")?.disabled).toBe(true);
  });
});

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
}
