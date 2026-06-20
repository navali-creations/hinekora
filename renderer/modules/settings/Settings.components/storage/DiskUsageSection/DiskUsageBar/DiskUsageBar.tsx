import clsx from "clsx";
import { FiEye, FiEyeOff } from "react-icons/fi";

import {
  formatBytes,
  formatPercentage,
} from "../../storage.utils/storage.utils";

interface BarSegment {
  bytes: number;
  colorClass: string;
  label: string;
}

interface DiskUsageBarProps {
  isRevealed: boolean;
  path: string;
  segments: BarSegment[];
  totalBytes: number;
  onRevealToggle: () => void;
}

function DiskUsageBar({
  isRevealed,
  path,
  segments,
  totalBytes,
  onRevealToggle,
}: DiskUsageBarProps) {
  const usedBytes = segments.reduce((sum, segment) => sum + segment.bytes, 0);
  const usedFraction = totalBytes > 0 ? usedBytes / totalBytes : 0;
  const freeBytes = Math.max(0, totalBytes - usedBytes);
  const visibleSegments = segments.filter((segment) => segment.bytes > 0);

  return (
    <div className="space-y-1.5">
      <div className="group flex items-center gap-1.5">
        <p className="truncate font-mono text-base-content/60 text-xs">
          {path}
        </p>
        <button
          className="shrink-0 text-base-content/40 transition-colors hover:text-base-content/70"
          title={isRevealed ? "Hide full path" : "Reveal full path"}
          type="button"
          onClick={onRevealToggle}
        >
          {isRevealed ? (
            <FiEyeOff className="h-3 w-3" />
          ) : (
            <FiEye className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-base-300">
        {segments.map((segment) => {
          const width = totalBytes > 0 ? (segment.bytes / totalBytes) * 100 : 0;
          if (width < 0.01) {
            return null;
          }

          return (
            <div
              className={clsx(
                segment.colorClass,
                "h-2.5 transition-all duration-300 first:rounded-l-full last:rounded-r-full",
              )}
              key={segment.label}
              style={{ width: `${Math.max(width, 0.3)}%` }}
              title={`${segment.label}: ${formatBytes(segment.bytes)}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-base-content/70 text-xs">
        <span>
          {formatBytes(usedBytes)} used of {formatBytes(totalBytes)} (
          {formatPercentage(usedFraction)})
        </span>
        <span>{formatBytes(freeBytes)} free</span>
      </div>
      {visibleSegments.length > 1 && (
        <div className="mt-0.5 flex flex-wrap gap-x-5 gap-y-2">
          {visibleSegments.map((segment) => {
            const segmentFraction =
              totalBytes > 0 ? segment.bytes / totalBytes : 0;

            return (
              <div className="flex items-start gap-1.5" key={segment.label}>
                <div
                  className={clsx(
                    "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                    segment.colorClass,
                  )}
                />
                <div className="flex flex-col">
                  <span className="text-base-content/70 text-xs leading-tight">
                    {segment.label}
                  </span>
                  <span className="text-[10px] text-base-content/40 leading-tight tabular-nums">
                    {formatBytes(segment.bytes)} (
                    {formatPercentage(segmentFraction)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { DiskUsageBar };
