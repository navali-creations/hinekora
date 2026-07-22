import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME,
  resolveEditorExportLibraryRoots,
  resolveEditorExportStorageRoot,
} from "../EditorExport.paths";

describe("editor export storage paths", () => {
  it("resolves the default, configured, and relative export roots", () => {
    const videosPath = join("C:", "Users", "seb", "Videos");

    expect(resolveEditorExportStorageRoot(null, videosPath)).toBe(
      join(videosPath, DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME),
    );
    expect(
      resolveEditorExportStorageRoot(join("D:", "Exports"), videosPath),
    ).toBe(join("D:", "Exports"));
    expect(resolveEditorExportStorageRoot("relative-exports", videosPath)).toBe(
      resolve("relative-exports"),
    );
  });

  it("returns the active and legacy roots once each", () => {
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
        recordingStorageRoot: join(videosPath, "Hinekora"),
        videosPath,
      }),
    ).toEqual([
      join(videosPath, "Hinekora", "Exports"),
      join(videosPath, "Hinekora", "Saved Edits"),
    ]);
  });
});
