import {
  calculateDiskUsage,
  collectManagedFiles,
  removeEmptyParentDirectories,
} from "~/main/utils/storage-files";

import {
  isManagedRecordingFilePath,
  type RecordingStorageFileEntry,
} from "./RecordingStorage.utils";

function collectRecordingFiles(root: string): RecordingStorageFileEntry[] {
  return collectManagedFiles(root, isManagedRecordingFilePath);
}

export {
  calculateDiskUsage,
  collectRecordingFiles,
  removeEmptyParentDirectories,
};
