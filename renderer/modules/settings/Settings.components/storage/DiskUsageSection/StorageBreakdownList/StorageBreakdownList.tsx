import type { ReactNode } from "react";
import {
  FiArchive,
  FiClock,
  FiDatabase,
  FiFile,
  FiHardDrive,
  FiPackage,
  FiPlay,
  FiTrash2,
} from "react-icons/fi";

import type { StorageBreakdownItem } from "~/main/modules/storage/Storage.dto";

import { formatBytes } from "../../storage.utils/storage.utils";

const CATEGORY_ICON_MAP: Record<StorageBreakdownItem["category"], ReactNode> = {
  "death-clips": <FiArchive className="h-3.5 w-3.5" />,
  "app-installation": <FiPackage className="h-3.5 w-3.5" />,
  "full-recordings": <FiHardDrive className="h-3.5 w-3.5" />,
  "manual-replays": <FiFile className="h-3.5 w-3.5" />,
  "rewind-buffer": <FiClock className="h-3.5 w-3.5" />,
  "export-videos": <FiPlay className="h-3.5 w-3.5" />,
  "temporary-files": <FiTrash2 className="h-3.5 w-3.5" />,
  database: <FiDatabase className="h-3.5 w-3.5" />,
};
const RECORDING_INVENTORY_CATEGORIES = new Set<
  StorageBreakdownItem["category"]
>(["death-clips", "full-recordings", "manual-replays", "temporary-files"]);

interface StorageBreakdownListProps {
  breakdown: StorageBreakdownItem[];
  displayedTotalBytes: number;
  exportVideosUsageTruncated: boolean;
  recordingUsageTruncated: boolean;
  rewindBufferEstimateBytes: number;
}

function StorageBreakdownList({
  breakdown,
  displayedTotalBytes,
  exportVideosUsageTruncated,
  recordingUsageTruncated,
  rewindBufferEstimateBytes,
}: StorageBreakdownListProps) {
  if (breakdown.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-base-100 p-3" data-testid="storage-breakdown">
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
          {rewindBufferEstimateBytes > 0 ? "~" : ""}
          {formatBytes(displayedTotalBytes)}
        </span>
      </div>

      <div className="space-y-1" data-testid="storage-breakdown-content">
        {breakdown.map((item) => {
          const percentage =
            displayedTotalBytes > 0
              ? (item.sizeBytes / displayedTotalBytes) * 100
              : 0;
          const fillClassName = item.estimated
            ? "h-1 rounded-full bg-primary/35 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.35)_0_4px,transparent_4px,transparent_8px)] transition-all duration-300"
            : "h-1 rounded-full bg-primary/60 transition-all duration-300";
          const isPartial =
            (item.category === "export-videos" && exportVideosUsageTruncated) ||
            (RECORDING_INVENTORY_CATEGORIES.has(item.category) &&
              recordingUsageTruncated);

          return (
            <div
              className="flex items-center gap-3 py-1.5"
              data-testid={`storage-breakdown-${item.category}`}
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
                    {isPartial ? ">=" : ""}
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
  );
}

export { StorageBreakdownList };
