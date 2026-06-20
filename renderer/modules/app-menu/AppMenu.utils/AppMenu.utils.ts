import type { LatestReleaseInfo } from "~/main/modules/updater/Updater.api";

type VersionParts = [number, number, number];

export function compareReleaseVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

export function getWhatsNewReleasesForView(
  releases: LatestReleaseInfo[],
  fromVersion: string | null,
  currentVersion: string | null,
): LatestReleaseInfo[] {
  if (releases.length === 0) {
    return [];
  }

  const ordered = [...releases].sort((a, b) =>
    compareReleaseVersions(a.version, b.version),
  );

  if (fromVersion && currentVersion) {
    const releasesUpToCurrentVersion = ordered.filter(
      (release) => compareReleaseVersions(release.version, currentVersion) <= 0,
    );
    const changedSeries = new Set(
      releasesUpToCurrentVersion
        .filter(
          (release) => compareReleaseVersions(release.version, fromVersion) > 0,
        )
        .map((release) => getMinorSeries(release.version)),
    );

    if (changedSeries.size > 0) {
      return releasesUpToCurrentVersion.filter((release) =>
        changedSeries.has(getMinorSeries(release.version)),
      );
    }
  }

  const latestRelease = ordered.at(-1);
  if (!latestRelease) {
    return [];
  }

  const latestSeries = getMinorSeries(latestRelease.version);
  return ordered.filter(
    (release) => getMinorSeries(release.version) === latestSeries,
  );
}

export function selectInitialWhatsNewRelease(
  releases: LatestReleaseInfo[],
  preferMinorRelease: boolean,
): LatestReleaseInfo | null {
  if (releases.length === 0) {
    return null;
  }

  if (preferMinorRelease) {
    const featureRelease = [...releases]
      .reverse()
      .find((release) => isFeatureRelease(release.changeType));

    if (featureRelease) {
      return featureRelease;
    }
  }

  return releases.at(-1) ?? null;
}

function isFeatureRelease(changeType: string): boolean {
  const lower = changeType.toLowerCase();
  return lower.includes("major") || lower.includes("minor");
}

function getMinorSeries(version: string): string {
  const [major, minor] = parseVersion(version);
  return `${major}.${minor}`;
}

function parseVersion(version: string): VersionParts {
  const [major = 0, minor = 0, patch = 0] = version
    .replace(/^v/, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));

  return [major, minor, patch];
}
