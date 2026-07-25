import { dirname } from "node:path";

import type { EditorExportFile } from "~/main/modules/editor/EditorExport.inventory";
import { resolveEditorExportInventoryRoots } from "~/main/modules/editor/EditorExport.inventory";
import { maskPath } from "~/main/utils/mask-path";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { StorageBreakdownItem, StorageExportVolume } from "./Storage.dto";
import type { StorageFile } from "./Storage.files";
import { sumFileSizes } from "./Storage.files";

const storagePathAnchors = [
  "Hinekora Recordings",
  "Hinekora Exports",
  "Hinekora",
];

interface ExportStorageVolumeTotals {
  deviceId: number;
  exportVideosSizeBytes: number;
  id: string;
  isConfiguredExportStorage: boolean;
  isRecordingStorage: boolean;
  path: string;
}

interface ExportStorageTotals {
  configuredRootKey: string;
  exportFileCount: number;
  exportVideosSizeBytes: number;
  storageDeviceId: number | null;
  volumes: Map<number, ExportStorageVolumeTotals>;
}

interface StorageBreakdownInput {
  appInstallationSizeBytes: number;
  databaseSizeBytes: number;
  deathClips: StorageFile[];
  fullRecordings: StorageFile[];
  manualReplays: StorageFile[];
  rewindBufferEstimateBytes: number;
  exportVideos: { fileCount: number; sizeBytes: number };
  temporaryFiles: StorageFile[];
}

function createExportStorageTotals(
  exportRoots: readonly string[],
  exportStorageRoot: string,
  storageDeviceId: number | null,
  getStorageDeviceId: (path: string | null) => number | null,
): ExportStorageTotals {
  const configuredRoot = resolveEditorExportInventoryRoots([
    exportStorageRoot,
  ])[0]!;
  const configuredRootKey = createStoragePathKey(configuredRoot);
  const totals: ExportStorageTotals = {
    configuredRootKey,
    exportFileCount: 0,
    exportVideosSizeBytes: 0,
    storageDeviceId,
    volumes: new Map(),
  };

  for (const path of exportRoots) {
    const deviceId = getStorageDeviceId(path);
    if (deviceId === null) {
      continue;
    }
    const isConfiguredExportStorage =
      createStoragePathKey(path) === configuredRootKey;
    const existing = totals.volumes.get(deviceId);
    if (existing) {
      existing.isConfiguredExportStorage ||= isConfiguredExportStorage;
      if (isConfiguredExportStorage) {
        existing.path = path;
      }
      continue;
    }
    totals.volumes.set(deviceId, {
      deviceId,
      exportVideosSizeBytes: 0,
      id: createStorageVolumeId(deviceId),
      isConfiguredExportStorage,
      isRecordingStorage:
        storageDeviceId !== null && deviceId === storageDeviceId,
      path,
    });
  }

  return totals;
}

function addExportFileToStorageTotals(
  totals: ExportStorageTotals,
  file: Pick<EditorExportFile, "deviceId" | "path" | "sizeBytes">,
): void {
  let volume = totals.volumes.get(file.deviceId);
  if (!volume) {
    const path = dirname(file.path);
    volume = {
      deviceId: file.deviceId,
      exportVideosSizeBytes: 0,
      id: createStorageVolumeId(file.deviceId),
      isConfiguredExportStorage:
        createStoragePathKey(path) === totals.configuredRootKey,
      isRecordingStorage:
        totals.storageDeviceId !== null &&
        file.deviceId === totals.storageDeviceId,
      path,
    };
    totals.volumes.set(file.deviceId, volume);
  }
  totals.exportFileCount += 1;
  totals.exportVideosSizeBytes += file.sizeBytes;
  volume.exportVideosSizeBytes += file.sizeBytes;
}

function createExportStorageVolumes(
  totals: ExportStorageTotals,
  calculateDiskUsage: (path: string) => {
    freeBytes: number;
    totalBytes: number;
  },
): StorageExportVolume[] {
  return [...totals.volumes.values()]
    .sort(
      (left, right) =>
        Number(right.isRecordingStorage) - Number(left.isRecordingStorage) ||
        Number(right.isConfiguredExportStorage) -
          Number(left.isConfiguredExportStorage) ||
        left.path.localeCompare(right.path),
    )
    .map((volume) => {
      const disk = calculateDiskUsage(volume.path);
      return {
        diskFreeBytes: disk.freeBytes,
        diskTotalBytes: disk.totalBytes,
        exportVideosSizeBytes: volume.exportVideosSizeBytes,
        id: volume.id,
        isRecordingStorage: volume.isRecordingStorage,
        path: maskPath(volume.path, storagePathAnchors),
      };
    });
}

function createStorageBreakdown(
  input: StorageBreakdownInput,
): StorageBreakdownItem[] {
  const items: StorageBreakdownItem[] = [
    {
      category: "full-recordings",
      label: "Full recordings",
      fileCount: input.fullRecordings.length,
      sizeBytes: sumFileSizes(input.fullRecordings),
    },
    {
      category: "death-clips",
      label: "Death clips",
      fileCount: input.deathClips.length,
      sizeBytes: sumFileSizes(input.deathClips),
    },
    {
      category: "manual-replays",
      label: "Manual replays",
      fileCount: input.manualReplays.length,
      sizeBytes: sumFileSizes(input.manualReplays),
    },
    {
      category: "export-videos",
      label: "Hinekora export videos",
      fileCount: input.exportVideos.fileCount,
      sizeBytes: input.exportVideos.sizeBytes,
    },
    {
      category: "app-installation",
      label: "App installation",
      fileCount: input.appInstallationSizeBytes > 0 ? 1 : 0,
      sizeBytes: input.appInstallationSizeBytes,
    },
    {
      category: "rewind-buffer",
      estimated: true,
      label: "Rewind buffer",
      fileCount: 1,
      sizeBytes: input.rewindBufferEstimateBytes,
    },
    {
      category: "temporary-files",
      label: "Temporary files",
      fileCount: input.temporaryFiles.length,
      sizeBytes: sumFileSizes(input.temporaryFiles),
    },
    {
      category: "database",
      label: "Database & app data",
      fileCount: input.databaseSizeBytes > 0 ? 1 : 0,
      sizeBytes: input.databaseSizeBytes,
    },
  ];

  return items
    .filter(
      (item) =>
        item.category === "temporary-files" ||
        item.category === "rewind-buffer" ||
        item.fileCount > 0 ||
        item.sizeBytes > 0,
    )
    .sort((left, right) => right.sizeBytes - left.sizeBytes);
}

function createStorageVolumeId(deviceId: number): string {
  return `storage-volume-${deviceId}`;
}

export type { ExportStorageTotals };
export {
  addExportFileToStorageTotals,
  createExportStorageTotals,
  createExportStorageVolumes,
  createStorageBreakdown,
  storagePathAnchors,
};
