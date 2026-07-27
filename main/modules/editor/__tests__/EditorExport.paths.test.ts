import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveEditorExportLibraryRoots,
  resolveEditorExportStorageRoot,
} from "../EditorExport.paths";

describe("editor export storage paths", () => {
  it("resolves the default, configured, and relative export roots", () => {
    const videosPath = join("C:", "Users", "seb", "Videos");

    expect(resolveEditorExportStorageRoot(null, videosPath)).toBe(
      join(videosPath, "Hinekora Exports"),
    );
    expect(
      resolveEditorExportStorageRoot(join("D:", "Exports"), videosPath),
    ).toBe(join("D:", "Exports"));
    expect(resolveEditorExportStorageRoot("relative-exports", videosPath)).toBe(
      resolve("relative-exports"),
    );
  });

  it("returns the active, default, registered, and legacy roots once each", () => {
    const videosPath = join("C:", "Users", "seb", "Videos");
    const recordingStorageRoot = join(videosPath, "Hinekora Recordings");

    expect(
      resolveEditorExportLibraryRoots({
        configuredExportPath: null,
        recordingStorageRoot,
        videosPath,
      }),
    ).toEqual([
      join(videosPath, "Hinekora Exports"),
      join(videosPath, "Hinekora", "Exports"),
      join(recordingStorageRoot, "Saved Edits"),
    ]);

    expect(
      resolveEditorExportLibraryRoots({
        configuredExportPath: join(videosPath, "Hinekora", "Exports"),
        registeredExportPaths: [
          join("D:", "Previous Exports", "old.mp4"),
          join("D:", "Previous Exports", "new.mp4"),
        ],
        recordingStorageRoot: join(videosPath, "Hinekora"),
        videosPath,
      }),
    ).toEqual([
      join(videosPath, "Hinekora", "Exports"),
      join(videosPath, "Hinekora Exports"),
      join(videosPath, "Hinekora", "Saved Edits"),
      join("D:", "Previous Exports"),
    ]);
  });

  it("does not scan custom export roots until they contain registered exports", () => {
    const videosPath = join("C:", "Users", "seb", "Videos");
    const recordingStorageRoot = join(videosPath, "Hinekora Recordings");
    const customRoot = join("D:", "Personal Videos");

    expect(
      resolveEditorExportLibraryRoots({
        configuredExportPath: customRoot,
        recordingStorageRoot,
        videosPath,
      }),
    ).toEqual([
      join(videosPath, "Hinekora Exports"),
      join(videosPath, "Hinekora", "Exports"),
      join(recordingStorageRoot, "Saved Edits"),
    ]);

    expect(
      resolveEditorExportLibraryRoots({
        configuredExportPath: customRoot,
        registeredExportPaths: [join(customRoot, "Saved.mp4")],
        recordingStorageRoot,
        videosPath,
      }),
    ).toContain(customRoot);
  });
});
