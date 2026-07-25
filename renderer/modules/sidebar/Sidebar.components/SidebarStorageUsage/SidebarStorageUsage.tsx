import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import {
  useBoundStore,
  useRecordingStorageShallow,
  useSettingsShallow,
} from "~/renderer/store";

import {
  defaultEditorExportMaxStorageGb,
  defaultRecordingMaxStorageGb,
} from "~/types";
import {
  calculateStorageUsagePercentage,
  formatStorageGigabytes,
} from "./SidebarStorageUsage.utils";

const RETRY_DELAY_MS = 30_000;
const WARNING_PERCENTAGE = 90;

function SidebarStorageUsage() {
  const retryCount = useRef(0);
  const isHydrated = useBoundStore((state) => state.isHydrated);
  const limits = useSettingsShallow((settings) => ({
    exports:
      settings.value?.editorExportMaxStorageGb ??
      defaultEditorExportMaxStorageGb,
    recordings:
      settings.value?.recordingMaxStorageGb ?? defaultRecordingMaxStorageGb,
  }));
  const { isLoading, refresh, usage, usageError } = useRecordingStorageShallow(
    (storage) => ({
      isLoading: storage.isUsageLoading,
      refresh: storage.refreshUsage,
      usage: storage.usage,
      usageError: storage.usageError,
    }),
  );

  useEffect(() => {
    if (!isHydrated || isLoading) {
      return;
    }
    const refreshUsage = () => void refresh();
    if (usageError) {
      if (retryCount.current > 0) {
        return;
      }
      const timeout = window.setTimeout(() => {
        retryCount.current += 1;
        refreshUsage();
      }, RETRY_DELAY_MS);
      return () => window.clearTimeout(timeout);
    }
    if (usage) {
      retryCount.current = 0;
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(refreshUsage, { timeout: 3_000 });
      return () => window.cancelIdleCallback(id);
    }
    const timeout = window.setTimeout(refreshUsage, 0);
    return () => window.clearTimeout(timeout);
  }, [isHydrated, isLoading, refresh, usage, usageError]);

  const recordingsUsed = usage
    ? usage.clipsSizeBytes + usage.recordingsSizeBytes
    : null;
  const exportsUsed = usage?.exportVideosSizeBytes ?? null;
  const rows = [
    {
      id: "recording",
      label: "Recording Storage",
      limit: limits.recordings,
      used: recordingsUsed,
      diskLow: usage?.lowDiskSpace === true,
      isPartial: false,
    },
    {
      id: "export",
      label: "Export Storage",
      limit: limits.exports,
      used: exportsUsed,
      diskLow: false,
      isPartial: usage?.exportVideosUsageTruncated === true,
    },
  ];

  return (
    <Link
      aria-label="Open data and storage settings"
      className="grid gap-3 rounded border border-base-content/15 bg-base-200/60 p-2 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
      search={{ tab: "data-storage" }}
      to="/settings"
    >
      {rows.map((row) => {
        const percentage = calculateStorageUsagePercentage(
          row.used ?? 0,
          row.limit,
        );
        const isOver = row.limit > 0 && percentage >= 100;
        const isNear = row.limit > 0 && percentage >= WARNING_PERCENTAGE;
        const warnings: string[] = [];
        if (row.diskLow) {
          warnings.push("Recording drive space is critically low");
        }
        if (isOver) {
          warnings.push(`${row.label} limit has been reached`);
        } else if (isNear) {
          warnings.push(`${row.label} is within 10% of its limit`);
        }
        if (row.isPartial) {
          warnings.push(
            "Export usage is partial because the library is very large",
          );
        }
        const warning = warnings.length > 0 ? warnings.join(". ") : null;
        const usedLabel =
          row.used === null ? "--" : formatStorageGigabytes(row.used);
        const usedCompactLabel = `${
          row.isPartial && row.used !== null ? "≥" : ""
        }${usedLabel.replace(" GB", "")}`;
        const limitLabel = row.limit > 0 ? `${row.limit} GB` : "Unlimited";
        const valueLabel = `${row.label}: ${
          row.isPartial && row.used !== null ? "at least " : ""
        }${usedLabel}${row.limit > 0 ? ` of ${limitLabel}` : ""}`;
        return (
          <span className="grid gap-1.5" key={row.id}>
            <span className="flex min-w-0 items-center justify-between gap-1 text-[11px] leading-tight">
              <span className="font-medium">{row.label}</span>
              {warning && (
                <span
                  aria-label={warning}
                  className={clsx(
                    "tooltip tooltip-left inline-flex shrink-0 cursor-help",
                    {
                      "text-error": isOver || row.diskLow,
                      "text-warning":
                        (isNear || row.isPartial) && !isOver && !row.diskLow,
                    },
                  )}
                  data-tip={warning}
                  role="status"
                >
                  <FiAlertTriangle aria-hidden="true" size={10} />
                </span>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-label={valueLabel}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={
                  row.used === null || row.limit <= 0 ? undefined : percentage
                }
                className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-base-content/20"
                role="progressbar"
              >
                {row.used !== null && row.limit > 0 && (
                  <span
                    className={clsx("absolute inset-y-0 left-0", {
                      "bg-error": isOver || row.diskLow,
                      "bg-primary": !isNear && !row.diskLow,
                      "bg-warning": isNear && !isOver && !row.diskLow,
                    })}
                    style={{ width: `${percentage}%` }}
                  />
                )}
              </span>
              <span className="shrink-0 font-mono text-[10px] leading-none tabular-nums">
                {row.limit > 0
                  ? `${usedCompactLabel} / ${limitLabel}`
                  : `${usedCompactLabel} / Unlimited`}
              </span>
            </span>
          </span>
        );
      })}
    </Link>
  );
}

export { SidebarStorageUsage };
