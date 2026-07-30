import { afterEach, describe, expect, it, vi } from "vitest";

import * as appLog from "./app-log";
import { requestRecorderOverlayOnStartup } from "./recorder-overlay-startup";

describe("recorder-overlay-startup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the recorder overlay when startup visibility is enabled", async () => {
    const setRecorderOverlayMode = vi.fn();
    const showRecorderOverlay = vi.fn(async () => undefined);
    const logInfo = vi.spyOn(appLog, "logInfo").mockImplementation(() => {});

    await expect(
      requestRecorderOverlayOnStartup(
        {
          recorderOverlayShowOnStartup: true,
          recorderOverlayStartMinimized: false,
        },
        { setRecorderOverlayMode, showRecorderOverlay },
      ),
    ).resolves.toBe(true);

    expect(setRecorderOverlayMode).toHaveBeenCalledWith("expanded");
    expect(showRecorderOverlay).toHaveBeenCalledTimes(1);
    expect(logInfo).toHaveBeenCalledWith(
      "startup",
      "Recorder overlay requested",
    );
  });

  it("skips the recorder overlay when startup visibility is disabled", async () => {
    const setRecorderOverlayMode = vi.fn();
    const showRecorderOverlay = vi.fn(async () => undefined);
    const logInfo = vi.spyOn(appLog, "logInfo").mockImplementation(() => {});

    await expect(
      requestRecorderOverlayOnStartup(
        {
          recorderOverlayShowOnStartup: false,
          recorderOverlayStartMinimized: true,
        },
        { setRecorderOverlayMode, showRecorderOverlay },
      ),
    ).resolves.toBe(false);

    expect(setRecorderOverlayMode).not.toHaveBeenCalled();
    expect(showRecorderOverlay).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith(
      "startup",
      "Recorder overlay startup request skipped",
    );
  });

  it("starts the requested recorder overlay minimized when configured", async () => {
    const setRecorderOverlayMode = vi.fn();
    const showRecorderOverlay = vi.fn(async () => undefined);

    await requestRecorderOverlayOnStartup(
      {
        recorderOverlayShowOnStartup: true,
        recorderOverlayStartMinimized: true,
      },
      { setRecorderOverlayMode, showRecorderOverlay },
    );

    expect(setRecorderOverlayMode).toHaveBeenCalledWith("minimized");
    expect(setRecorderOverlayMode.mock.invocationCallOrder[0]).toBeLessThan(
      showRecorderOverlay.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
