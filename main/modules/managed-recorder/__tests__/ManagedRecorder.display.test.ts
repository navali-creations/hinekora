import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CaptureTarget } from "~/types";
import {
  extractDisplayId,
  isPathOfExileWindowTarget,
  resolveDisplayByScreenSourceIndex,
  resolveNativeDisplayResolution,
  resolveStoredCaptureTargetResolution,
} from "../ManagedRecorder.display";

function createDisplay(
  id: number,
  width: number,
  height: number,
  scaleFactor = 1,
): Electron.Display {
  return {
    id,
    scaleFactor,
    size: { width, height },
  } as Electron.Display;
}

function createOptions(displays: Electron.Display[] = []) {
  return {
    getDisplays: vi.fn(() => displays),
    getPrimaryDisplay: vi.fn(() => createDisplay(100, 2560, 1440)),
  };
}

describe("ManagedRecorder display helpers", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts display ids and stored target resolutions", () => {
    expect(extractDisplayId("-123")).toBe("-123");
    expect(extractDisplayId("screen:456:0")).toBe("456");
    expect(extractDisplayId("window:abc")).toBeNull();
    expect(
      resolveStoredCaptureTargetResolution({
        kind: "display",
        id: "primary",
        label: "Primary",
        width: 1279.6,
        height: 720.2,
      }),
    ).toEqual({ width: 1280, height: 720 });
    expect(
      resolveStoredCaptureTargetResolution({
        kind: "display",
        id: "primary",
        label: "Primary",
        width: Number.NaN,
        height: 720,
      }),
    ).toBeNull();
  });

  it("resolves display targets by stored geometry, display id, screen index, and primary display", () => {
    const displays = [
      createDisplay(10, 1280, 720),
      createDisplay(11, 1920, 1080, 1.5),
    ];
    const storedOptions = createOptions();

    expect(
      resolveNativeDisplayResolution(
        {
          kind: "display",
          id: "primary",
          label: "Primary",
          width: 1600.4,
          height: 900.3,
        },
        storedOptions,
      ),
    ).toEqual({ width: 1600, height: 900 });
    expect(storedOptions.getDisplays).not.toHaveBeenCalled();

    const options = createOptions(displays);
    expect(
      resolveNativeDisplayResolution(
        { kind: "display", id: "11", label: "Display 11" },
        options,
      ),
    ).toEqual({ width: 2880, height: 1620 });
    expect(
      resolveNativeDisplayResolution(
        { kind: "display", id: "screen:1:0", label: "Screen 1" },
        options,
      ),
    ).toEqual({ width: 2880, height: 1620 });
    expect(
      resolveNativeDisplayResolution(
        { kind: "display", id: "primary", label: "Primary" },
        options,
      ),
    ).toEqual({ width: 2560, height: 1440 });
  });

  it("resolves display arrays by screen source index", () => {
    const displays = [createDisplay(1, 800, 600), createDisplay(2, 1024, 768)];

    expect(resolveDisplayByScreenSourceIndex(displays, "screen:1:0")).toBe(
      displays[1],
    );
    expect(
      resolveDisplayByScreenSourceIndex(displays, "window:poe:1"),
    ).toBeNull();
    expect(
      resolveDisplayByScreenSourceIndex(displays, "screen:9:0"),
    ).toBeNull();
  });

  it("uses stored window target geometry without native lookup", () => {
    const target: CaptureTarget = {
      kind: "window",
      id: "window:123:0",
      label: "Path of Exile",
      width: 1600,
      height: 900,
    };
    const options = createOptions();

    expect(resolveNativeDisplayResolution(target, options)).toEqual({
      width: 1600,
      height: 900,
    });
    expect(options.getDisplays).not.toHaveBeenCalled();
  });

  it("falls back to the primary display for Path of Exile window targets without stored geometry", () => {
    const options = createOptions();
    const target: CaptureTarget = {
      kind: "window",
      id: "window:poe:1",
      label: "Path of Exile 1",
      width: null,
      height: null,
    };

    expect(isPathOfExileWindowTarget(target)).toBe(true);
    expect(resolveNativeDisplayResolution(target, options)).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  it("does not treat display targets as Path of Exile window targets", () => {
    expect(
      isPathOfExileWindowTarget({
        kind: "display",
        id: "screen:0:0",
        label: "Path of Exile 2",
      }),
    ).toBe(false);
  });

  it("returns null when no native display resolution can be resolved", () => {
    expect(
      resolveNativeDisplayResolution(
        { kind: "window", id: "window:123:0", label: "Missing" },
        createOptions(),
      ),
    ).toBeNull();
  });
});
