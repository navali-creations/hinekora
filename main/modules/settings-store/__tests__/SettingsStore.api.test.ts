import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: electronMocks,
}));

import {
  SettingsStoreAPI,
  SettingsStoreClipPreviewOverlayAPI,
  SettingsStoreOverlayAPI,
  SettingsStoreRecorderOverlayAPI,
} from "../SettingsStore.api";
import { SettingsStoreChannel } from "../SettingsStore.channels";

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
      SettingsStoreClipPreviewOverlayAPI.dismissClipPreviewInfoAlert(),
    ).rejects.toThrow("Settings could not be saved");
  });

  it("returns successful settings responses unchanged", async () => {
    const settings = { replayClipPreviewResolution: "1080p" };
    electronMocks.invoke.mockResolvedValue(settings);

    await expect(SettingsStoreAPI.get()).resolves.toBe(settings);
  });

  it("uses the scoped overlay channel for recorder settings and changes", async () => {
    const settings = {
      activeGame: "poe1" as const,
      auraOverlayShowEditingFrame: true,
      manualReplaySeconds: 30,
      manualReplayShowPreview: false,
      replayClipPreviewResolution: "720p" as const,
      selectedCaptureProfileId: null,
      selectedCaptureProfileIdsByGame: {},
      selectedProfileId: null,
      telemetryCrashReporting: false,
    };
    electronMocks.invoke.mockResolvedValue(settings);

    await expect(SettingsStoreRecorderOverlayAPI.get()).resolves.toBe(settings);
    expect(electronMocks.invoke).toHaveBeenCalledWith(
      SettingsStoreChannel.GetOverlaySnapshot,
    );

    const callback = vi.fn();
    const unsubscribe = SettingsStoreRecorderOverlayAPI.onChanged(callback);
    const listener = electronMocks.on.mock.calls[0]?.[1];
    listener?.({}, settings);

    expect(callback).toHaveBeenCalledWith(settings);
    unsubscribe();
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      SettingsStoreChannel.OverlayChanged,
      listener,
    );
  });

  it("keeps aura and clip-preview settings on their scoped channels", async () => {
    const settings = { telemetryCrashReporting: false };
    electronMocks.invoke.mockResolvedValue(settings);

    await expect(SettingsStoreOverlayAPI.get()).resolves.toBe(settings);
    await expect(SettingsStoreClipPreviewOverlayAPI.get()).resolves.toBe(
      settings,
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      SettingsStoreChannel.GetOverlaySnapshot,
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      SettingsStoreChannel.GetClipPreviewOverlaySnapshot,
    );

    const auraCallback = vi.fn();
    const clipCallback = vi.fn();
    const stopAura = SettingsStoreOverlayAPI.onChanged(auraCallback);
    const auraListener = electronMocks.on.mock.calls[0]?.[1];
    const stopClip = SettingsStoreClipPreviewOverlayAPI.onChanged(clipCallback);
    const clipListener = electronMocks.on.mock.calls[1]?.[1];
    auraListener?.({}, settings);
    clipListener?.({}, settings);

    expect(auraCallback).toHaveBeenCalledWith(settings);
    expect(clipCallback).toHaveBeenCalledWith(settings);
    stopAura();
    stopClip();
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      SettingsStoreChannel.OverlayChanged,
      auraListener,
    );
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      SettingsStoreChannel.ClipPreviewOverlayChanged,
      clipListener,
    );
  });
});
