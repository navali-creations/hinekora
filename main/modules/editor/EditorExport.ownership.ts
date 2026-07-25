import { dirname } from "node:path";

import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { EditorExportFile } from "./EditorExport.inventory";
import type { EditorExportOwnershipRecord } from "./EditorExportOwnership.repository";

interface EditorExportOwnershipPolicy {
  isOwned(file: EditorExportFile): boolean;
  registeredByPathKey: ReadonlyMap<string, EditorExportOwnershipRecord>;
}

interface EditorExportCompatibilityOwnership {
  root: string;
  trackingStartedAtMs: number | null;
}

function createEditorExportOwnershipPolicy(
  registeredExports: readonly EditorExportOwnershipRecord[],
  implicitlyOwnedRoots: readonly string[],
  compatibility?: EditorExportCompatibilityOwnership,
): EditorExportOwnershipPolicy {
  const implicitRootKeys = new Set(
    implicitlyOwnedRoots.map(createStoragePathKey),
  );
  const compatibilityRootKey = compatibility
    ? createStoragePathKey(compatibility.root)
    : null;
  const registeredByPathKey = new Map(
    registeredExports.map((record) => [
      createStoragePathKey(record.path),
      record,
    ]),
  );

  return {
    isOwned: (file) => {
      if (implicitRootKeys.has(createStoragePathKey(dirname(file.path)))) {
        return true;
      }
      const registered = registeredByPathKey.get(
        createStoragePathKey(file.path),
      );
      if (registered) {
        return hasSameRegisteredEditorExportIdentity(registered, file);
      }

      return (
        compatibility?.trackingStartedAtMs !== null &&
        compatibility?.trackingStartedAtMs !== undefined &&
        compatibilityRootKey === createStoragePathKey(dirname(file.path)) &&
        file.modifiedAt.getTime() <= compatibility.trackingStartedAtMs
      );
    },
    registeredByPathKey,
  };
}

function hasSameRegisteredEditorExportIdentity(
  registered: EditorExportOwnershipRecord,
  file: Pick<
    EditorExportFile,
    "deviceId" | "inode" | "modifiedAt" | "sizeBytes"
  >,
): boolean {
  return (
    (registered.deviceId === 0 ||
      file.deviceId === 0 ||
      registered.deviceId === file.deviceId) &&
    (registered.inode === 0 ||
      file.inode === 0 ||
      registered.inode === file.inode) &&
    registered.sizeBytes === file.sizeBytes &&
    Math.abs(registered.modifiedAtMs - file.modifiedAt.getTime()) <= 1
  );
}

function hasSameEditorExportIdentity(
  file: Pick<
    EditorExportFile,
    "deviceId" | "inode" | "modifiedAt" | "sizeBytes"
  >,
  stats: {
    dev?: number;
    ino?: number;
    mtimeMs?: number;
    size: number;
  },
): boolean {
  if (
    file.deviceId !== 0 &&
    stats.dev !== undefined &&
    file.deviceId !== stats.dev
  ) {
    return false;
  }
  if (file.inode !== 0 && stats.ino !== undefined && file.inode !== stats.ino) {
    return false;
  }

  return (
    file.sizeBytes === Math.max(0, stats.size) &&
    (stats.mtimeMs === undefined ||
      Math.abs(file.modifiedAt.getTime() - stats.mtimeMs) <= 1)
  );
}

export { createEditorExportOwnershipPolicy, hasSameEditorExportIdentity };
