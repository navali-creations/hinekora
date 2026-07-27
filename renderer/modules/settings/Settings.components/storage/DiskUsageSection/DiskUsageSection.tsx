import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiDatabase, FiPackage } from "react-icons/fi";

import type {
  StorageInfo,
  StorageRevealPathsResult,
} from "~/main/modules/storage/Storage.dto";

import { DiskUsageBar } from "./DiskUsageBar/DiskUsageBar";
import { ExportVolumeDiskUsageBar } from "./ExportVolumeDiskUsageBar/ExportVolumeDiskUsageBar";
import { StorageBreakdownList } from "./StorageBreakdownList/StorageBreakdownList";

interface DiskUsageSectionProps {
  info: StorageInfo;
}

function DiskUsageSection({ info }: DiskUsageSectionProps) {
  const [revealedPaths, setRevealedPaths] =
    useState<StorageRevealPathsResult | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const pathsVersionRef = useRef(info.calculatedAt);

  useEffect(() => {
    if (pathsVersionRef.current === info.calculatedAt) {
      return;
    }
    pathsVersionRef.current = info.calculatedAt;
    setRevealedPaths(null);
    setIsRevealed(false);
  }, [info.calculatedAt]);

  const handleRevealToggle = useCallback(async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }

    if (!revealedPaths) {
      try {
        const paths = await window.electron.storage.revealPaths();
        setRevealedPaths(paths);
      } catch {
        return;
      }
    }
    setIsRevealed(true);
  }, [isRevealed, revealedPaths]);

  const displayPath =
    isRevealed && revealedPaths ? revealedPaths.storagePath : info.storagePath;
  const revealedExportPaths = new Map(
    revealedPaths?.exportStorageVolumes.map((volume) => [
      volume.id,
      volume.path,
    ]) ?? [],
  );
  const recordingExportVolume = info.exportStorageVolumes.find(
    (volume) => volume.isRecordingStorage,
  );
  const separateExportVolumes = info.exportStorageVolumes.filter(
    (volume) => !volume.isRecordingStorage,
  );
  const exportsOnRecordingStorageBytes =
    recordingExportVolume?.exportVideosSizeBytes ?? 0;
  const trackedBytesOnStorageDrive =
    info.recordingsSizeBytes +
    exportsOnRecordingStorageBytes +
    info.temporarySizeBytes +
    (info.appInstallationOnStorageDrive ? info.appInstallationSizeBytes : 0) +
    (info.databaseOnStorageDrive ? info.databaseSizeBytes : 0);
  const otherDiskUsedBytes = Math.max(
    0,
    info.diskTotalBytes - info.diskFreeBytes - trackedBytesOnStorageDrive,
  );
  const displayedBreakdownTotalBytes =
    info.totalTrackedSizeBytes + info.rewindBufferEstimateBytes;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="font-semibold text-sm">Disk Usage</span>
        <DiskUsageBar
          isRevealed={isRevealed}
          path={displayPath}
          segments={[
            {
              label: "Other disk usage",
              bytes: otherDiskUsedBytes,
              colorClass: "bg-base-content/20",
            },
            {
              label: "Hinekora Recordings",
              bytes: info.recordingsSizeBytes,
              colorClass: "bg-primary",
            },
            ...(exportsOnRecordingStorageBytes > 0
              ? [
                  {
                    label: "Hinekora Exports",
                    bytes: exportsOnRecordingStorageBytes,
                    colorClass: "bg-sky-400",
                  },
                ]
              : []),
            {
              label: "Temporary files",
              bytes: info.temporarySizeBytes,
              colorClass: "bg-info",
            },
            ...(info.appInstallationOnStorageDrive
              ? [
                  {
                    label: "App installation",
                    bytes: info.appInstallationSizeBytes,
                    colorClass: "bg-accent",
                  },
                ]
              : []),
            ...(info.databaseOnStorageDrive
              ? [
                  {
                    label: "Database",
                    bytes: info.databaseSizeBytes,
                    colorClass: "bg-warning",
                  },
                ]
              : []),
          ]}
          totalBytes={info.diskTotalBytes}
          onRevealToggle={handleRevealToggle}
        />
        {separateExportVolumes.map((volume) => (
          <ExportVolumeDiskUsageBar
            key={volume.id}
            isRevealed={isRevealed}
            onRevealToggle={handleRevealToggle}
            revealedPath={revealedExportPaths.get(volume.id)}
            volume={volume}
          />
        ))}
      </div>

      {(info.exportVideosUsageTruncated || info.recordingUsageTruncated) && (
        <div className="flex items-center gap-1.5 text-warning text-xs">
          <FiAlertTriangle className="h-3 w-3 shrink-0" />
          Storage totals are partial because the media library is very large
        </div>
      )}

      {!info.databaseOnStorageDrive && info.databaseSizeBytes > 0 && (
        <div className="flex items-center gap-1.5 text-info text-xs">
          <FiDatabase className="h-3 w-3" />
          Database is on a different drive than recording storage
        </div>
      )}

      {!info.appInstallationOnStorageDrive &&
        info.appInstallationSizeBytes > 0 && (
          <div className="flex items-center gap-1.5 text-info text-xs">
            <FiPackage className="h-3 w-3" />
            App installation is on a different drive than recording storage
          </div>
        )}

      <StorageBreakdownList
        breakdown={info.breakdown}
        displayedTotalBytes={displayedBreakdownTotalBytes}
        exportVideosUsageTruncated={info.exportVideosUsageTruncated}
        recordingUsageTruncated={info.recordingUsageTruncated}
        rewindBufferEstimateBytes={info.rewindBufferEstimateBytes}
      />
    </div>
  );
}

export default DiskUsageSection;
