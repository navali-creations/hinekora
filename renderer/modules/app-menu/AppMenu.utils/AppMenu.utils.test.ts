import { describe, expect, it } from "vitest";

import type { LatestReleaseInfo } from "~/main/modules/updater/Updater.api";

import {
  compareReleaseVersions,
  getWhatsNewReleasesForView,
  selectInitialWhatsNewRelease,
} from "./AppMenu.utils";

function makeRelease(version: string, changeType: string): LatestReleaseInfo {
  return {
    version,
    name: `v${version}`,
    body: `${changeType} for ${version}`,
    publishedAt: "2026-05-24T00:00:00Z",
    url: `https://example.com/v${version}`,
    changeType,
    entries: [],
  };
}

describe("AppMenu.utils", () => {
  describe("compareReleaseVersions", () => {
    it("sorts semantic versions by major, minor, then patch", () => {
      expect(compareReleaseVersions("0.18.2", "0.18.10")).toBeLessThan(0);
      expect(compareReleaseVersions("0.19.0", "0.18.10")).toBeGreaterThan(0);
      expect(compareReleaseVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
    });

    it("accepts versions with a leading v", () => {
      expect(compareReleaseVersions("v0.18.1", "0.18.0")).toBeGreaterThan(0);
    });
  });

  describe("getWhatsNewReleasesForView", () => {
    const releases = [
      makeRelease("0.18.2", "Patch Changes"),
      makeRelease("0.18.1", "Patch Changes"),
      makeRelease("0.18.0", "Minor Changes"),
      makeRelease("0.17.1", "Patch Changes"),
    ];

    it("returns release series containing versions between last seen and current version", () => {
      expect(
        getWhatsNewReleasesForView(releases, "0.17.1", "0.18.2").map(
          (release) => release.version,
        ),
      ).toEqual(["0.18.0", "0.18.1", "0.18.2"]);
    });

    it("keeps already-seen series context for patch updates", () => {
      expect(
        getWhatsNewReleasesForView(releases, "0.18.0", "0.18.1").map(
          (release) => release.version,
        ),
      ).toEqual(["0.18.0", "0.18.1"]);
    });

    it("falls back to the latest minor series for manual opens", () => {
      expect(
        getWhatsNewReleasesForView(releases, null, null).map(
          (release) => release.version,
        ),
      ).toEqual(["0.18.0", "0.18.1", "0.18.2"]);
    });
  });

  describe("selectInitialWhatsNewRelease", () => {
    it("selects the newest feature release when requested", () => {
      const releases = [
        makeRelease("0.18.0", "Minor Changes"),
        makeRelease("0.18.1", "Patch Changes"),
        makeRelease("0.18.2", "Patch Changes"),
      ];

      expect(selectInitialWhatsNewRelease(releases, true)?.version).toBe(
        "0.18.0",
      );
    });

    it("selects the latest patch when there is no feature release", () => {
      const releases = [
        makeRelease("0.18.1", "Patch Changes"),
        makeRelease("0.18.2", "Patch Changes"),
      ];

      expect(selectInitialWhatsNewRelease(releases, true)?.version).toBe(
        "0.18.2",
      );
    });

    it("selects the latest release for manual opens", () => {
      const releases = [
        makeRelease("0.18.0", "Minor Changes"),
        makeRelease("0.18.1", "Patch Changes"),
      ];

      expect(selectInitialWhatsNewRelease(releases, false)?.version).toBe(
        "0.18.1",
      );
    });
  });
});
