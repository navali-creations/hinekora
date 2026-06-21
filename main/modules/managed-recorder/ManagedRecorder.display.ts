import { logInfo } from "~/main/utils/app-log";
import { getNativeDisplayDimensions } from "~/main/utils/display-geometry";

import type { CaptureTarget } from "~/types";
import {
  type ManagedRecorderResolution,
  parseScreenCaptureSourceIndex,
} from "./ManagedRecorder.utils";

const MANAGED_RECORDER_LOG_SCOPE = "managed-recorder";

interface NativeDisplayResolutionOptions {
  getDisplays: () => Electron.Display[];
  getPrimaryDisplay: () => Electron.Display;
}

function resolveNativeDisplayResolution(
  target: CaptureTarget,
  options: NativeDisplayResolutionOptions,
): ManagedRecorderResolution | null {
  const storedResolution = resolveStoredCaptureTargetResolution(target);
  if (storedResolution) {
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Using stored target resolution", {
      targetKind: target.kind,
      targetId: target.id,
      width: storedResolution.width,
      height: storedResolution.height,
    });

    return storedResolution;
  }

  const displays = options.getDisplays();
  const targetDisplayId = extractDisplayId(target.id);
  const displayById =
    targetDisplayId !== null
      ? (displays.find((item) => String(item.id) === targetDisplayId) ?? null)
      : null;
  const displayByScreenIndex = resolveDisplayByScreenSourceIndex(
    displays,
    target.id,
  );
  const display =
    displayById ??
    displayByScreenIndex ??
    (target.kind === "display" && target.id === "primary"
      ? options.getPrimaryDisplay()
      : null) ??
    (isPathOfExileWindowTarget(target) ? options.getPrimaryDisplay() : null);

  if (display) {
    const displayResolution = getNativeDisplayDimensions(display);
    if (!displayById && displayByScreenIndex) {
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Using screen index resolution", {
        targetKind: target.kind,
        targetId: target.id,
        width: displayResolution.width,
        height: displayResolution.height,
      });
    }

    return displayResolution;
  }

  return null;
}

function extractDisplayId(targetId: string): string | null {
  if (/^-?\d+$/.test(targetId)) {
    return targetId;
  }

  const screenMatch = /^screen:([^:]+):\d+$/i.exec(targetId);

  return screenMatch?.[1] ?? null;
}

function resolveDisplayByScreenSourceIndex(
  displays: Electron.Display[],
  targetId: string,
): Electron.Display | null {
  const screenIndex = parseScreenCaptureSourceIndex(targetId);
  if (screenIndex === null) {
    return null;
  }

  return displays[screenIndex] ?? null;
}

function resolveStoredCaptureTargetResolution(
  target: CaptureTarget,
): ManagedRecorderResolution | null {
  if (
    typeof target.width !== "number" ||
    typeof target.height !== "number" ||
    !Number.isFinite(target.width) ||
    !Number.isFinite(target.height)
  ) {
    return null;
  }

  return {
    width: Math.round(target.width),
    height: Math.round(target.height),
  };
}

function isPathOfExileWindowTarget(target: CaptureTarget): boolean {
  if (target.kind !== "window") {
    return false;
  }

  const label = target.label.trim().replace(/\s+/g, " ").toLowerCase();

  return (
    label === "path of exile" ||
    label === "path of exile 1" ||
    label === "path of exile 2"
  );
}

export type { NativeDisplayResolutionOptions };
export {
  extractDisplayId,
  isPathOfExileWindowTarget,
  resolveDisplayByScreenSourceIndex,
  resolveNativeDisplayResolution,
  resolveStoredCaptureTargetResolution,
};
