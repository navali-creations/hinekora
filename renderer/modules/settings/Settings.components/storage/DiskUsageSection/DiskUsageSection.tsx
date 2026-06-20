import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  FiArchive,
  FiClock,
  FiDatabase,
  FiFile,
  FiHardDrive,
  FiPackage,
  FiTrash2,
} from "react-icons/fi";

import type {
  StorageBreakdownItem,
  StorageInfo,
  StorageRevealPathsResult,
} from "~/main/modules/storage/Storage.dto";

import { formatBytes } from "../storage.utils/storage.utils";
import { DiskUsageBar } from "./DiskUsageBar/DiskUsageBar";

const CATEGORY_ICON_MAP: Record<StorageBreakdownItem["category"], ReactNode> = {
  "death-clips": <FiArchive className="h-3.5 w-3.5" />,
  "app-installation": <FiPackage className="h-3.5 w-3.5" />,
  "full-recordings": <FiHardDrive className="h-3.5 w-3.5" />,
  "manual-clips": <FiFile className="h-3.5 w-3.5" />,
  "rewind-buffer": <FiClock className="h-3.5 w-3.5" />,
  "temporary-files": <FiTrash2 className="h-3.5 w-3.5" />,
  database: <FiDatabase className="h-3.5 w-3.5" />,
};

interface DiskUsageSectionProps {
  info: StorageInfo;
}

function DiskUsageSection({ info }: DiskUsageSectionProps) {
  const [revealedPaths, setRevealedPaths] =
    useState<StorageRevealPathsResult | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

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
  const databaseOnStorageDrive =
    info.diskTotalBytes === info.databaseDiskTotalBytes &&
    info.diskFreeBytes === info.databaseDiskFreeBytes;
  const appInstallationOnStorageDrive =
    info.diskTotalBytes === info.appInstallationDiskTotalBytes &&
    info.diskFreeBytes === info.appInstallationDiskFreeBytes;
  const trackedBytesOnStorageDrive =
    info.mediaSizeBytes +
    info.temporarySizeBytes +
    (appInstallationOnStorageDrive ? info.appInstallationSizeBytes : 0) +
    (databaseOnStorageDrive ? info.databaseSizeBytes : 0);
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
              label: "Hinekora media",
              bytes: info.mediaSizeBytes,
              colorClass: "bg-primary",
            },
            {
              label: "Temporary files",
              bytes: info.temporarySizeBytes,
              colorClass: "bg-info",
            },
            ...(appInstallationOnStorageDrive
              ? [
                  {
                    label: "App installation",
                    bytes: info.appInstallationSizeBytes,
                    colorClass: "bg-accent",
                  },
                ]
              : []),
            ...(databaseOnStorageDrive
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
      </div>

      {!databaseOnStorageDrive && info.databaseSizeBytes > 0 && (
        <div className="flex items-center gap-1.5 text-info text-xs">
          <FiDatabase className="h-3 w-3" />
          Database is on a different drive than recording storage
        </div>
      )}

      {!appInstallationOnStorageDrive && info.appInstallationSizeBytes > 0 && (
        <div className="flex items-center gap-1.5 text-info text-xs">
          <FiPackage className="h-3 w-3" />
          App installation is on a different drive than recording storage
        </div>
      )}

      {info.breakdown.length > 0 && (
        <div
          className="rounded-lg bg-base-100 p-3"
          data-testid="storage-breakdown"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FiDatabase className="h-3.5 w-3.5 shrink-0 text-base-content/50" />
              <span className="truncate font-semibold text-base-content/70 text-xs">
                What's using space?
              </span>
            </div>
            <span
              className="shrink-0 text-base-content/50 text-xs tabular-nums"
              data-testid="storage-breakdown-total"
            >
              {info.rewindBufferEstimateBytes > 0 ? "~" : ""}
              {formatBytes(displayedBreakdownTotalBytes)}
            </span>
          </div>

          <div className="space-y-1" data-testid="storage-breakdown-content">
            {info.breakdown.map((item) => {
              const percentage =
                displayedBreakdownTotalBytes > 0
                  ? (item.sizeBytes / displayedBreakdownTotalBytes) * 100
                  : 0;
              const fillClassName = item.estimated
                ? "h-1 rounded-full bg-primary/35 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.35)_0_4px,transparent_4px,transparent_8px)] transition-all duration-300"
                : "h-1 rounded-full bg-primary/60 transition-all duration-300";

              return (
                <div
                  className="flex items-center gap-3 py-1.5"
                  key={item.category}
                >
                  <span className="shrink-0 text-base-content/50">
                    {CATEGORY_ICON_MAP[item.category] ?? (
                      <FiFile className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-xs">
                        {item.label}
                      </span>
                      <span className="shrink-0 text-base-content/50 text-xs tabular-nums">
                        {item.estimated ? "~" : ""}
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-base-300">
                      <div
                        className={fillClassName}
                        style={{ width: `${Math.max(percentage, 0.5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiskUsageSection;
