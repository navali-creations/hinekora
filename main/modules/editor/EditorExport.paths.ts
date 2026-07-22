import { isAbsolute, join, resolve, win32 } from "node:path";

import { createStoragePathKey } from "~/main/utils/storage-path-key";

const DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME = "Hinekora Exports";
const LEGACY_EDITOR_EXPORT_DIRECTORY_PARTS = ["Hinekora", "Exports"];
const PREVIOUS_EDITOR_EXPORT_DIRECTORY_NAME = "Saved Edits";

interface ResolveEditorExportLibraryRootsInput {
  configuredExportPath: string | null;
  recordingStorageRoot: string;
  videosPath: string;
}

function resolveEditorExportStorageRoot(
  configuredPath: string | null,
  videosPath: string,
): string {
  const root =
    configuredPath ?? join(videosPath, DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME);

  return isCrossPlatformAbsolute(root) ? root : resolve(root);
}

function resolveEditorExportLibraryRoots(
  input: ResolveEditorExportLibraryRootsInput,
): string[] {
  const roots = [
    resolveEditorExportStorageRoot(
      input.configuredExportPath,
      input.videosPath,
    ),
    join(input.videosPath, ...LEGACY_EDITOR_EXPORT_DIRECTORY_PARTS),
    join(input.recordingStorageRoot, PREVIOUS_EDITOR_EXPORT_DIRECTORY_NAME),
  ];

  return Array.from(
    new Map(roots.map((root) => [createStoragePathKey(root), root])).values(),
  );
}

function isCrossPlatformAbsolute(path: string): boolean {
  return isAbsolute(path) || win32.isAbsolute(path);
}

export {
  DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME,
  resolveEditorExportLibraryRoots,
  resolveEditorExportStorageRoot,
};
