import { dirname } from "node:path";

import { createStoragePathAliasKeys } from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { EditorExportFile } from "./EditorExport.inventory";
import type { EditorExportOwnershipRecord } from "./EditorExportOwnership.repository";

interface EditorExportOwnershipPolicy {
  isOwned(file: EditorExportFile): boolean;
}

function createEditorExportOwnershipPolicy(
  registeredExports: readonly EditorExportOwnershipRecord[],
  implicitlyOwnedRoots: readonly string[],
): EditorExportOwnershipPolicy {
  const implicitRootKeys = createAliasKeySet(implicitlyOwnedRoots);
  const registeredByPathKey = createRegisteredOwnershipMap(registeredExports);

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

      return false;
    },
  };
}

function createAliasKeySet(paths: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const path of paths) {
    for (const key of createStoragePathAliasKeys(path)) {
      keys.add(key);
    }
  }

  return keys;
}

function createRegisteredOwnershipMap(
  records: readonly EditorExportOwnershipRecord[],
): Map<string, EditorExportOwnershipRecord> {
  const registeredByPathKey = new Map<string, EditorExportOwnershipRecord>();
  for (const record of records) {
    for (const key of createStoragePathAliasKeys(record.path)) {
      registeredByPathKey.set(key, record);
    }
  }

  return registeredByPathKey;
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

function createEditorExportFileAliasKeyMap(
  files: readonly EditorExportFile[],
): Map<string, EditorExportFile> {
  const filesByAliasKey = new Map<string, EditorExportFile>();
  for (const file of files) {
    for (const key of createStoragePathAliasKeys(file.path)) {
      filesByAliasKey.set(key, file);
    }
  }

  return filesByAliasKey;
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

export {
  createEditorExportFileAliasKeyMap,
  createEditorExportOwnershipPolicy,
  hasSameEditorExportIdentity,
  hasSameRegisteredEditorExportIdentity,
};
