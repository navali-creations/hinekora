import { dirname, isAbsolute, join, resolve, win32 } from "node:path";

import { createStoragePathKey } from "~/main/utils/storage-path-key";

const DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME = "Hinekora Exports";
const LEGACY_EDITOR_EXPORT_DIRECTORY_PARTS = ["Hinekora", "Exports"];
const PREVIOUS_EDITOR_EXPORT_DIRECTORY_NAME = "Saved Edits";

interface ResolveEditorExportLibraryRootsInput {
  configuredExportPath: string | null;
  registeredExportPaths?: readonly string[];
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
  const configuredRoot = resolveEditorExportStorageRoot(
    input.configuredExportPath,
    input.videosPath,
  );
  const implicitRoots = resolveImplicitlyOwnedEditorExportRoots(input);
  const implicitRootKeys = new Set(implicitRoots.map(createStoragePathKey));
  const roots = [
    ...(implicitRootKeys.has(createStoragePathKey(configuredRoot))
      ? [configuredRoot]
      : []),
    ...implicitRoots,
    ...(input.registeredExportPaths ?? []).map(dirname),
  ];

  return Array.from(
    new Map(roots.map((root) => [createStoragePathKey(root), root])).values(),
  );
}

function resolveImplicitlyOwnedEditorExportRoots(
  input: Pick<
    ResolveEditorExportLibraryRootsInput,
    "recordingStorageRoot" | "videosPath"
  >,
): string[] {
  return Array.from(
    new Map(
      [
        join(input.videosPath, DEFAULT_EDITOR_EXPORT_DIRECTORY_NAME),
        join(input.videosPath, ...LEGACY_EDITOR_EXPORT_DIRECTORY_PARTS),
        join(input.recordingStorageRoot, PREVIOUS_EDITOR_EXPORT_DIRECTORY_NAME),
      ].map((root) => [createStoragePathKey(root), root]),
    ).values(),
  );
}

function isCrossPlatformAbsolute(path: string): boolean {
  return isAbsolute(path) || win32.isAbsolute(path);
}

export {
  resolveEditorExportLibraryRoots,
  resolveEditorExportStorageRoot,
  resolveImplicitlyOwnedEditorExportRoots,
};
