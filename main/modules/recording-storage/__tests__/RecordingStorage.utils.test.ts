import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isManagedRecordingFilePath,
  resolveRecordingStorageRoot,
} from "../RecordingStorage.utils";

describe("RecordingStorage utils", () => {
  it("recognizes flat managed OBS outputs", () => {
    const root = join("C:", "Videos", "Hinekora Recordings");

    expect(
      isManagedRecordingFilePath(root, join(root, "2026-06-10 01-30-19.mp4")),
    ).toBe(true);
    expect(
      isManagedRecordingFilePath(root, join(root, "2026-06-10_01-30-19.mp4")),
    ).toBe(true);
    expect(
      isManagedRecordingFilePath(
        root,
        join(root, "2026-06-10 01-30-19-death-10s.mp4"),
      ),
    ).toBe(true);
  });

  it("recognizes managed media subdirectories", () => {
    const root = join("C:", "Videos", "Hinekora Recordings");

    expect(
      isManagedRecordingFilePath(
        root,
        join(root, "Full Recordings", "run.mp4"),
      ),
    ).toBe(true);
    expect(
      isManagedRecordingFilePath(root, join(root, "Death Clips", "death.mp4")),
    ).toBe(true);
    expect(
      isManagedRecordingFilePath(
        root,
        join(root, "Manual Clips", "manual.mp4"),
      ),
    ).toBe(true);
  });

  it("keeps arbitrary root media out of managed cleanup", () => {
    const root = join("C:", "Videos", "Hinekora Recordings");

    expect(isManagedRecordingFilePath(root, root)).toBe(false);
    expect(isManagedRecordingFilePath(root, join(root, "boss-fight.mp4"))).toBe(
      false,
    );
    expect(
      isManagedRecordingFilePath(root, join(root, "nested", "2026-06-10.mp4")),
    ).toBe(false);
  });

  it("keeps legacy session directory cleanup supported", () => {
    const root = join("C:", "Videos", "Hinekora Recordings");

    expect(
      isManagedRecordingFilePath(
        root,
        join(root, "Hinekora-2026-06-10_01-30-19", "recording.mp4"),
      ),
    ).toBe(true);
  });

  it("resolves the configured storage root or the default videos location", () => {
    expect(
      resolveRecordingStorageRoot(null, join("C:", "Users", "seb", "Videos")),
    ).toBe(join("C:", "Users", "seb", "Videos", "Hinekora Recordings"));
    expect(
      resolveRecordingStorageRoot(join("D:", "Recordings"), "ignored"),
    ).toBe(join("D:", "Recordings"));
    expect(resolveRecordingStorageRoot("relative-recordings", "ignored")).toBe(
      join(process.cwd(), "relative-recordings"),
    );
  });
});
