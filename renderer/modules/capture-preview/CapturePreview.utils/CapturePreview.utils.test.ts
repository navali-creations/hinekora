import { describe, expect, it } from "vitest";

import type { CaptureProfile, GameId } from "~/types";
import {
  createCapturePreviewSourceLabel,
  createCapturePreviewSourcesWithGameFallback,
  createCaptureTargetFromPreviewSource,
  findCapturePreviewSourceForTarget,
  isCapturePreviewSourceAvailable,
  isCapturePreviewSourceCompatibleWithGame,
  isCapturePreviewSourceCompatibleWithProfile,
  isUnavailableGameWindowFallbackSource,
  resolveCapturePreviewSourceId,
  resolveCaptureTargetProfile,
  sourceMatchesCaptureTarget,
} from "./CapturePreview.utils";

function createCaptureProfile(game: GameId): CaptureProfile {
  return {
    captureTarget: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    deathClipSeconds: 10,
    game,
    id: `capture-profile-${game}`,
    isDefault: false,
    name: `${game} Capture`,
    recordingAudioInputDeviceId: null,
    recordingAudioOutputDeviceId: null,
    recordingAutoStartMode: "off",
    recordingClipQuality: "high",
    recordingEncoder: "hardware_h264",
    recordingFps: 60,
    recordingHideOverlaysFromRecording: true,
    recordingHideOverlaysFromRewind: true,
    recordingOutputResolution: "native",
    recordingRunQuality: "moderate",
    recordingTrackBookmarksInRewind: true,
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

const sources = [
  {
    id: "screen:primary:0",
    name: "Screen 1",
    kind: "screen" as const,
    displayId: "display-primary",
    width: 2560,
    height: 1440,
    thumbnailDataUrl: null,
  },
  {
    id: "window:poe:1",
    name: "Path of Exile 1",
    kind: "window" as const,
    game: "poe1" as const,
    displayId: null,
    width: null,
    height: null,
    thumbnailDataUrl: null,
  },
];
const screenSource = sources[0]!;
const windowSource = sources[1]!;
const poe1Profile = createCaptureProfile("poe1");
const poe2Profile = createCaptureProfile("poe2");
const poe2AltProfile: CaptureProfile = {
  ...createCaptureProfile("poe2"),
  id: "capture-profile-poe2-alt",
  name: "poe2 Alt Capture",
};

describe("CapturePreview utils", () => {
  it("persists the stable display id for screen sources", () => {
    expect(
      createCaptureTargetFromPreviewSource({
        id: "screen:1:0",
        name: "Screen 1",
        kind: "screen",
        displayId: "display-primary",
        width: 2560,
        height: 1440,
        thumbnailDataUrl: null,
      }),
    ).toEqual({
      kind: "display",
      id: "display-primary",
      label: "Screen 1",
      game: null,
      width: 2560,
      height: 1440,
    });
  });

  it("persists the current source id for window sources", () => {
    expect(
      createCaptureTargetFromPreviewSource({
        id: "window:poe:1",
        name: "Path of Exile 1",
        kind: "window",
        game: "poe1",
        displayId: null,
        width: null,
        height: null,
        thumbnailDataUrl: null,
      }),
    ).toEqual({
      kind: "window",
      id: "window:poe:1",
      label: "Path of Exile 1",
      game: "poe1",
      width: null,
      height: null,
    });
  });

  it("persists unavailable game window labels without the not-running suffix", () => {
    expect(
      createCaptureTargetFromPreviewSource({
        available: false,
        id: "missing-window:poe2",
        name: "Path of Exile 2 (not running)",
        kind: "window",
        game: "poe2",
        displayId: null,
        width: null,
        height: null,
        thumbnailDataUrl: null,
      }),
    ).toEqual({
      kind: "window",
      id: "missing-window:poe2",
      label: "Path of Exile 2",
      game: "poe2",
      width: null,
      height: null,
    });
  });

  it("matches display targets by stable display id", () => {
    expect(
      sourceMatchesCaptureTarget(screenSource, {
        kind: "display",
        id: "display-primary",
        label: "Screen 1",
      }),
    ).toBe(true);
  });

  it("matches older persisted screen source ids", () => {
    expect(
      sourceMatchesCaptureTarget(screenSource, {
        kind: "display",
        id: "screen:primary:0",
        label: "Screen 1",
      }),
    ).toBe(true);
  });

  it("finds the source for a capture target", () => {
    expect(
      findCapturePreviewSourceForTarget(
        {
          kind: "window",
          id: "window:poe:1",
          label: "Path of Exile 1",
          game: "poe1",
        },
        sources,
      ),
    ).toBe(windowSource);
  });

  it("matches restarted game windows by game metadata when source ids change", () => {
    expect(
      sourceMatchesCaptureTarget(
        {
          ...windowSource,
          id: "window:poe:next",
        },
        {
          kind: "window",
          id: "window:poe:previous",
          label: "Path of Exile",
          game: "poe1",
        },
      ),
    ).toBe(true);
  });

  it("matches legacy Path of Exile 1 labels when game metadata is missing", () => {
    expect(
      sourceMatchesCaptureTarget(windowSource, {
        kind: "window",
        id: "window:poe:previous",
        label: "Path of Exile",
      }),
    ).toBe(true);
  });

  it("does not match same-label windows when both sides have different game metadata", () => {
    expect(
      sourceMatchesCaptureTarget(
        {
          ...windowSource,
          game: "poe2",
        },
        {
          kind: "window",
          id: "window:poe:previous",
          label: "Path of Exile 1",
          game: "poe1",
        },
      ),
    ).toBe(false);
  });

  it("resolves the current source id from profile target before selected source", () => {
    expect(
      resolveCapturePreviewSourceId(
        {
          kind: "display",
          id: "display-primary",
          label: "Screen 1",
        },
        sources,
        "window:poe:1",
      ),
    ).toBe("screen:primary:0");
  });

  it("rebases a selected unavailable game source to its live window", () => {
    const poe2Source = {
      ...windowSource,
      game: "poe2" as const,
      id: "window:poe2:1",
      name: "Path of Exile 2",
    };

    expect(
      resolveCapturePreviewSourceId(
        {
          kind: "display",
          id: "display-primary",
          label: "Screen 1",
        },
        [screenSource, poe2Source],
        "missing-window:poe2",
        "poe2",
      ),
    ).toBe("window:poe2:1");
  });

  it("does not keep a selected game window from another active game", () => {
    const poe2Source = {
      ...windowSource,
      game: "poe2" as const,
      id: "window:poe:2",
      name: "Path of Exile 2",
    };

    expect(
      resolveCapturePreviewSourceId(null, [poe2Source], poe2Source.id, "poe1"),
    ).toBeNull();
    expect(isCapturePreviewSourceCompatibleWithGame(poe2Source, "poe1")).toBe(
      false,
    );
  });

  it("prefers the active game window over a selected generic screen", () => {
    expect(
      resolveCapturePreviewSourceId(null, sources, screenSource.id, "poe1"),
    ).toBe(windowSource.id);
  });

  it("prefers the active game unavailable fallback over a selected generic screen", () => {
    const unavailableSources = createCapturePreviewSourcesWithGameFallback([
      screenSource,
    ]);

    expect(
      resolveCapturePreviewSourceId(
        null,
        unavailableSources,
        screenSource.id,
        "poe2",
      ),
    ).toBe("missing-window:poe2");
  });

  it("waits for sources before resolving a stale persisted source id", () => {
    expect(
      resolveCapturePreviewSourceId(
        {
          kind: "display",
          id: "screen:primary:0",
          label: "Screen 1",
        },
        [],
        null,
      ),
    ).toBeNull();
  });

  it("adds unavailable game sources when game windows are missing", () => {
    const nextSources = createCapturePreviewSourcesWithGameFallback([
      screenSource,
    ]);

    expect(nextSources).toHaveLength(3);
    expect(nextSources[1]).toMatchObject({
      available: false,
      game: "poe1",
      id: "missing-window:poe1",
      kind: "window",
    });
    expect(nextSources[2]).toMatchObject({
      available: false,
      game: "poe2",
      id: "missing-window:poe2",
      kind: "window",
    });
    expect(createCapturePreviewSourceLabel(nextSources[1]!)).toBe(
      "Path of Exile 1 (not running)",
    );
    expect(isCapturePreviewSourceAvailable(nextSources[1]!)).toBe(false);
    expect(isUnavailableGameWindowFallbackSource(nextSources[1]!)).toBe(true);
    expect(isUnavailableGameWindowFallbackSource(windowSource)).toBe(false);
  });

  it("does not treat a missing selected source as available", () => {
    expect(isCapturePreviewSourceAvailable(null)).toBe(false);
  });

  it("only adds unavailable game sources for missing game windows", () => {
    const nextSources = createCapturePreviewSourcesWithGameFallback(sources);

    expect(nextSources).toHaveLength(3);
    expect(nextSources[2]).toMatchObject({
      available: false,
      game: "poe2",
      id: "missing-window:poe2",
      kind: "window",
    });
  });

  it("selects the unavailable source for a persisted game window until the live source exists", () => {
    const unavailableSources = createCapturePreviewSourcesWithGameFallback([
      screenSource,
    ]);
    const target = {
      kind: "window" as const,
      id: "window:poe:previous",
      label: "Path of Exile 1",
      game: "poe1" as const,
    };

    expect(
      resolveCapturePreviewSourceId(target, unavailableSources, null),
    ).toBe("missing-window:poe1");
    expect(resolveCapturePreviewSourceId(target, sources, null)).toBe(
      "window:poe:1",
    );
  });

  it("resolves the destination profile from the selected game source", () => {
    const source = {
      id: "missing-window:poe2",
      name: "Path of Exile 2 (not running)",
      kind: "window" as const,
      game: "poe2" as const,
      available: false,
      displayId: null,
      width: null,
      height: null,
      thumbnailDataUrl: null,
    };

    expect(
      resolveCaptureTargetProfile(
        [poe1Profile, poe2Profile],
        poe1Profile.id,
        "poe1",
        source,
      ),
    ).toBe(poe2Profile);
    expect(
      isCapturePreviewSourceCompatibleWithProfile(source, poe1Profile),
    ).toBe(false);
    expect(
      isCapturePreviewSourceCompatibleWithProfile(source, poe2Profile),
    ).toBe(true);
  });

  it("prefers the selected same-game profile for game sources", () => {
    const source = {
      id: "window:poe2:1",
      name: "Path of Exile 2",
      kind: "window" as const,
      game: "poe2" as const,
      displayId: null,
      width: null,
      height: null,
      thumbnailDataUrl: null,
    };

    expect(
      resolveCaptureTargetProfile(
        [poe1Profile, poe2Profile, poe2AltProfile],
        poe2AltProfile.id,
        "poe2",
        source,
      ),
    ).toBe(poe2AltProfile);
  });

  it("uses the selected profile for generic screen sources even when active game is stale", () => {
    expect(
      resolveCaptureTargetProfile(
        [poe1Profile, poe2Profile],
        poe2Profile.id,
        "poe1",
        screenSource,
      ),
    ).toBe(poe2Profile);
  });
});
