import { describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";
import {
  createUnavailablePlaybackRates,
  getEnabledMenuItems,
  resolveSpeedMenuPosition,
} from "./EditorTimelineSpeedMenu.utils";

describe("EditorTimelineSpeedMenu utils", () => {
  it("resolves an upward position centered on the trigger", () => {
    const trigger = document.createElement("button");
    trigger.getBoundingClientRect = vi.fn(() => ({
      bottom: 224,
      height: 24,
      left: 100,
      right: 124,
      top: 200,
      width: 24,
      x: 100,
      y: 200,
      toJSON: vi.fn(),
    }));

    expect(resolveSpeedMenuPosition(trigger)).toEqual({
      bottom: window.innerHeight - 196,
      left: 112,
    });
    expect(resolveSpeedMenuPosition(null)).toBe(null);
  });

  it("marks only rates that would exceed the export duration unavailable", () => {
    const asset = createEditorTestAsset({ durationSeconds: 22_000 });
    const project = createEditorTestProject(asset);
    const clip = createEditorTestTimelineClip(asset, {
      durationSeconds: 22_000,
      outSeconds: 22_000,
      sourceOutSeconds: 22_000,
    });
    const unavailableRates = createUnavailablePlaybackRates({
      clipId: clip.id,
      project: {
        ...project,
        durationSeconds: 22_000,
        tracks: [{ ...project.tracks[0]!, clips: [clip] }],
      },
    });

    expect(unavailableRates.has(0.25)).toBe(true);
    expect(unavailableRates.has(0.5)).toBe(false);
    expect(createUnavailablePlaybackRates({ clipId: null, project }).size).toBe(
      10,
    );
  });

  it("returns only enabled menu items", () => {
    const enabledItem = document.createElement("button");
    const disabledItem = document.createElement("button");
    disabledItem.disabled = true;

    expect(getEnabledMenuItems([null, disabledItem, enabledItem])).toEqual([
      enabledItem,
    ]);
  });
});
