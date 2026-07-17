import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import {
  useBoundStore,
  useRecordingStorageShallow,
  useSettingsSelector,
} from "~/renderer/store";

import { defaultRecordingMaxStorageGb } from "~/types";
import {
  calculateDiskBoundUsagePercentage,
  calculateStorageUsagePercentage,
  formatStorageGigabytes,
} from "./AppStorageUsageMeter.utils";

const STORAGE_WARNING_PERCENTAGE = 90;
const STORAGE_USAGE_RETRY_DELAY_MS = 30_000;
const LOW_DISK_SPACE_TOOLTIP =
  "Recording drive space is critically low. New recordings and clips may fail unless space is freed.";
const STORAGE_WARNING_TOOLTIP =
  "Storage is within 10% of its limit. Once full, the oldest recordings and clips will be deleted and replaced by new recordings and clips.";
const COMBINED_STORAGE_WARNING_TOOLTIP = `${LOW_DISK_SPACE_TOOLTIP} ${STORAGE_WARNING_TOOLTIP}`;

function AppStorageUsageMeter() {
  const navigate = useNavigate();
  const usageRetryCount = useRef(0);
  const isAppHydrated = useBoundStore((state) => state.isHydrated);
  const recordingMaxStorageGb = useSettingsSelector(
    (settings) =>
      settings.value?.recordingMaxStorageGb ?? defaultRecordingMaxStorageGb,
  );
  const { isUsageLoading, refreshUsage, usage, usageError } =
    useRecordingStorageShallow((recordingStorage) => ({
      isUsageLoading: recordingStorage.isUsageLoading,
      refreshUsage: recordingStorage.refreshUsage,
      usage: recordingStorage.usage,
      usageError: recordingStorage.usageError,
    }));

  useEffect(() => {
    if (!isAppHydrated || isUsageLoading) {
      return;
    }

    const refresh = () => void refreshUsage();
    if (usageError !== null) {
      if (usageRetryCount.current > 0) {
        return;
      }
      const retryTimeoutId = window.setTimeout(() => {
        usageRetryCount.current += 1;
        refresh();
      }, STORAGE_USAGE_RETRY_DELAY_MS);
      return () => window.clearTimeout(retryTimeoutId);
    }
    if (usage !== null) {
      usageRetryCount.current = 0;
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      const idleCallbackId = window.requestIdleCallback(refresh, {
        timeout: 3_000,
      });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isAppHydrated, isUsageLoading, refreshUsage, usage, usageError]);

  const usedBytes = usage
    ? usage.clipsSizeBytes + usage.recordingsSizeBytes
    : null;
  const diskFreeBytes = usage?.diskFreeBytes ?? null;
  const hasConfiguredStorageLimit = recordingMaxStorageGb > 0;
  const hasKnownUsagePercentage =
    usedBytes !== null && (hasConfiguredStorageLimit || diskFreeBytes !== null);
  const usagePercentage = hasConfiguredStorageLimit
    ? calculateStorageUsagePercentage(usedBytes ?? 0, recordingMaxStorageGb)
    : calculateDiskBoundUsagePercentage(usedBytes ?? 0, diskFreeBytes);
  const usedLabel =
    usedBytes === null ? "--" : formatStorageGigabytes(usedBytes);
  const diskFreeLabel =
    diskFreeBytes === null ? "--" : formatStorageGigabytes(diskFreeBytes);
  const limitLabel = hasConfiguredStorageLimit
    ? `${recordingMaxStorageGb} GB`
    : diskFreeLabel;
  let usageLabel = usageError
    ? "Recording storage usage is unavailable"
    : "Loading recording storage usage";
  if (usedBytes !== null && usageError) {
    usageLabel = `${usedLabel} used; storage usage may be out of date`;
  } else if (usedBytes !== null) {
    if (hasConfiguredStorageLimit) {
      usageLabel = `${usedLabel} used of ${limitLabel}`;
    } else if (diskFreeBytes === null) {
      usageLabel = `${usedLabel} used; recording drive free space is unavailable`;
    } else {
      usageLabel = `${usedLabel} used; ${diskFreeLabel} free on the recording drive`;
    }
  }
  const isDiskSpaceLow = usage?.lowDiskSpace === true;
  const isNearStorageLimit =
    hasConfiguredStorageLimit &&
    usedBytes !== null &&
    usagePercentage >= STORAGE_WARNING_PERCENTAGE;
  const isAtStorageLimit = hasConfiguredStorageLimit && usagePercentage >= 100;
  let storageWarningTooltip = STORAGE_WARNING_TOOLTIP;
  if (isDiskSpaceLow) {
    storageWarningTooltip = isNearStorageLimit
      ? COMBINED_STORAGE_WARNING_TOOLTIP
      : LOW_DISK_SPACE_TOOLTIP;
  }
  const showStorageWarning = isDiskSpaceLow || isNearStorageLimit;
  const isUsagePending =
    isUsageLoading || (usedBytes === null && usageError === null);

  const handleOpenStorageSettings = () => {
    void navigate({
      to: "/settings",
      search: { tab: "data-storage" },
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {showStorageWarning && (
        <span
          className={clsx(
            "tooltip tooltip-bottom no-drag inline-flex h-8 w-5 items-center justify-center",
            {
              "tooltip-error text-error": isDiskSpaceLow,
              "tooltip-warning text-warning": !isDiskSpaceLow,
            },
          )}
          data-tip={storageWarningTooltip}
        >
          <span
            aria-label={storageWarningTooltip}
            className="inline-flex h-full w-full items-center justify-center"
            role="status"
            tabIndex={0}
          >
            <FiAlertTriangle aria-hidden="true" size={12} />
          </span>
        </span>
      )}
      <span
        className="tooltip tooltip-left no-drag"
        data-tip="Open data and storage settings"
      >
        <button
          aria-busy={isUsagePending}
          aria-label={`${usageLabel}. Open data and storage settings`}
          className="no-drag flex h-10 shrink-0 cursor-pointer items-center justify-center px-2 text-[10px] hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
          type="button"
          onClick={handleOpenStorageSettings}
        >
          <span className="inline-grid w-max gap-1">
            <span className="text-center leading-none tabular-nums">
              {usedLabel} / {limitLabel}
            </span>
            <span
              aria-label={usageLabel}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={
                hasKnownUsagePercentage ? usagePercentage : undefined
              }
              className="relative block h-1 w-full overflow-hidden rounded-full bg-base-content/20"
              role="progressbar"
            >
              {hasKnownUsagePercentage && (
                <span
                  className={clsx("absolute inset-y-0 left-0", {
                    "bg-error": isAtStorageLimit || isDiskSpaceLow,
                    "bg-primary": !isNearStorageLimit && !isDiskSpaceLow,
                    "bg-warning":
                      isNearStorageLimit &&
                      !isAtStorageLimit &&
                      !isDiskSpaceLow,
                  })}
                  style={{ width: `${usagePercentage}%` }}
                />
              )}
            </span>
          </span>
        </button>
      </span>
    </div>
  );
}

export { AppStorageUsageMeter };
