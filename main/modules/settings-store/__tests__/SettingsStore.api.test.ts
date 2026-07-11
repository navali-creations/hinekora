import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: electronMocks,
}));

import { SettingsStoreAPI } from "../SettingsStore.api";

describe("SettingsStoreAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects settings update validation failures", async () => {
    electronMocks.invoke.mockResolvedValue({
      ok: false,
      error: "Invalid preview resolution",
    });

    await expect(
      SettingsStoreAPI.update({ replayClipPreviewResolution: "720p" }),
    ).rejects.toThrow("Invalid preview resolution");
  });

  it("rejects clip preview alert dismissal failures", async () => {
    electronMocks.invoke.mockResolvedValue({
      ok: false,
      error: "Settings could not be saved",
    });

    await expect(
      SettingsStoreAPI.dismissClipPreviewInfoAlert(),
    ).rejects.toThrow("Settings could not be saved");
  });

  it("returns successful settings responses unchanged", async () => {
    const settings = { replayClipPreviewResolution: "1080p" };
    electronMocks.invoke.mockResolvedValue(settings);

    await expect(SettingsStoreAPI.get()).resolves.toBe(settings);
  });
});
