import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import { resolveAuraProfileReferenceViewport } from "./resolveAuraProfileReferenceViewport";

const profile: Profile = {
  captureTarget: {
    height: 1080,
    id: "display-1",
    kind: "display",
    label: "Display 1",
    width: 1920,
  },
  createdAt: new Date(0).toISOString(),
  cropRegions: [],
  game: "poe1",
  id: "profile-1",
  name: "Default",
  overlayPlacements: [],
  targetFps: 30,
  updatedAt: new Date(0).toISOString(),
};

describe("resolveAuraProfileReferenceViewport", () => {
  it("uses complete capture target dimensions", () => {
    expect(resolveAuraProfileReferenceViewport(profile)).toEqual({
      height: 1080,
      width: 1920,
    });
  });

  it("ignores missing and incomplete capture targets", () => {
    expect(resolveAuraProfileReferenceViewport(null)).toBeNull();
    expect(
      resolveAuraProfileReferenceViewport({
        ...profile,
        captureTarget: { ...profile.captureTarget!, height: null },
      }),
    ).toBeNull();
  });
});
