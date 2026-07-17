import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as appLog from "~/main/utils/app-log";

import {
  applyRecordingStoragePathMigrations,
  isManagedRecordingFilePath,
  planLegacyRecordingStorageMediaDirectoryMigrations,
  resolveRecordingStorageMediaDirectory,
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
    expect(
      isManagedRecordingFilePath(root, join(root, "2026-06-10_01-30-19.MP4")),
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
        join(root, "Manual Replays", "manual.mp4"),
      ),
    ).toBe(true);
    expect(
      isManagedRecordingFilePath(
        root,
        join(root, "Manual Clips", "legacy-manual.mp4"),
      ),
    ).toBe(true);
  });

  it("resolves manual replay media to the canonical folder", () => {
    const root = join("C:", "Videos", "Hinekora Recordings");

    expect(resolveRecordingStorageMediaDirectory(root, "manualReplays")).toBe(
      join(root, "Manual Replays"),
    );
  });

  it("renames legacy folders to manual replays", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");

    try {
      mkdirSync(legacyDirectory);
      writeFileSync(join(legacyDirectory, "manual.mp4"), "manual");

      const migrations =
        planLegacyRecordingStorageMediaDirectoryMigrations(root);
      const appliedMigrations = applyRecordingStoragePathMigrations(migrations);

      expect(existsSync(legacyDirectory)).toBe(false);
      expect(existsSync(join(canonicalDirectory, "manual.mp4"))).toBe(true);
      expect(migrations).toEqual([
        {
          from: resolve(legacyDirectory),
          to: resolve(canonicalDirectory),
        },
      ]);
      expect(appliedMigrations).toEqual(migrations);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("merges legacy folders when manual replays already exists", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");

    try {
      mkdirSync(legacyDirectory);
      mkdirSync(canonicalDirectory);
      writeFileSync(join(legacyDirectory, "manual.mp4"), "legacy");
      writeFileSync(join(canonicalDirectory, "manual.mp4"), "canonical");
      writeFileSync(join(canonicalDirectory, "manual (2).mp4"), "canonical 2");

      const migrations =
        planLegacyRecordingStorageMediaDirectoryMigrations(root);
      const appliedMigrations = applyRecordingStoragePathMigrations(migrations);

      expect(existsSync(legacyDirectory)).toBe(false);
      expect(readdirSync(canonicalDirectory).sort()).toEqual([
        "manual (2).mp4",
        "manual (3).mp4",
        "manual.mp4",
      ]);
      expect(migrations).toEqual([
        {
          from: resolve(join(legacyDirectory, "manual.mp4")),
          to: resolve(join(canonicalDirectory, "manual (3).mp4")),
        },
      ]);
      expect(appliedMigrations).toEqual(migrations);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("merges legacy folders without renaming when no target file exists", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");

    try {
      mkdirSync(legacyDirectory);
      mkdirSync(canonicalDirectory);
      writeFileSync(join(legacyDirectory, "manual.mp4"), "legacy");

      const migrations =
        planLegacyRecordingStorageMediaDirectoryMigrations(root);
      const appliedMigrations = applyRecordingStoragePathMigrations(migrations);

      expect(existsSync(legacyDirectory)).toBe(false);
      expect(existsSync(join(canonicalDirectory, "manual.mp4"))).toBe(true);
      expect(migrations).toEqual([
        {
          from: resolve(join(legacyDirectory, "manual.mp4")),
          to: resolve(join(canonicalDirectory, "manual.mp4")),
        },
      ]);
      expect(appliedMigrations).toEqual(migrations);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("removes legacy folders after directory-only merges", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");
    const legacyNestedDirectory = join(legacyDirectory, "nested");
    const canonicalNestedDirectory = join(canonicalDirectory, "nested");

    try {
      mkdirSync(legacyNestedDirectory, { recursive: true });
      mkdirSync(canonicalDirectory);
      writeFileSync(join(legacyNestedDirectory, "manual.mp4"), "legacy");

      const migrations =
        planLegacyRecordingStorageMediaDirectoryMigrations(root);
      const appliedMigrations = applyRecordingStoragePathMigrations(migrations);

      expect(existsSync(legacyDirectory)).toBe(false);
      expect(existsSync(join(canonicalNestedDirectory, "manual.mp4"))).toBe(
        true,
      );
      expect(migrations).toEqual([
        {
          from: resolve(legacyNestedDirectory),
          to: resolve(canonicalNestedDirectory),
        },
      ]);
      expect(appliedMigrations).toEqual(migrations);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("keeps missing source and target migrations unapplied", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const missingSourcePath = join(root, "Manual Clips", "manual.mp4");
    const missingTargetPath = join(root, "Manual Replays", "manual.mp4");
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});

    try {
      const appliedMigrations = applyRecordingStoragePathMigrations([
        {
          from: missingSourcePath,
          to: missingTargetPath,
        },
      ]);

      expect(appliedMigrations).toEqual([]);
      expect(logWarn).toHaveBeenCalledWith(
        "recording-storage",
        "Legacy recording media directory migration source and target are missing",
        expect.objectContaining({
          errorCode: "Error",
          legacyDirectoryFile: "manual.mp4",
          targetDirectoryFile: "manual.mp4",
        }),
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("logs sanitized legacy media migration failures", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalPath = join(root, "Manual Replays");
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});

    try {
      mkdirSync(legacyDirectory);
      writeFileSync(join(legacyDirectory, "manual.mp4"), "manual");
      writeFileSync(canonicalPath, "not a directory");

      const migrations =
        planLegacyRecordingStorageMediaDirectoryMigrations(root);
      const appliedMigrations = applyRecordingStoragePathMigrations(migrations);

      expect(migrations).toEqual([]);
      expect(appliedMigrations).toEqual([]);
      expect(existsSync(legacyDirectory)).toBe(true);
      expect(logWarn).toHaveBeenCalledWith(
        "recording-storage",
        "Legacy recording media directory migration planning failed",
        expect.objectContaining({
          errorCode: expect.any(String),
          legacyDirectoryFile: "Manual Clips",
          targetDirectoryFile: "Manual Replays",
        }),
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("ignores legacy paths that are not directories", () => {
    const root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
    const legacyPath = join(root, "Manual Clips");

    try {
      writeFileSync(legacyPath, "not a directory");

      const migrations =
        planLegacyRecordingStorageMediaDirectoryMigrations(root);
      const appliedMigrations = applyRecordingStoragePathMigrations(migrations);

      expect(existsSync(legacyPath)).toBe(true);
      expect(existsSync(join(root, "Manual Replays"))).toBe(false);
      expect(migrations).toEqual([]);
      expect(appliedMigrations).toEqual([]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
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
