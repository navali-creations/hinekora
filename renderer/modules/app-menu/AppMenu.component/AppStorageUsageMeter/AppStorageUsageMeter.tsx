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
  calculateStorageUsagePercentage,
  formatStorageGigabytes,
} from "./AppStorageUsageMeter.utils";

const STORAGE_WARNING_PERCENTAGE = 90;
const STORAGE_USAGE_RETRY_DELAY_MS = 30_000;
const STORAGE_WARNING_TOOLTIP =
  "Storage is within 10% of its limit. Once full, the oldest recordings and clips will be deleted and replaced by new recordings and clips.";

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
  const usagePercentage = calculateStorageUsagePercentage(
    usedBytes ?? 0,
    recordingMaxStorageGb,
  );
  const usedLabel =
    usedBytes === null ? "--" : formatStorageGigabytes(usedBytes);
  const limitLabel =
    recordingMaxStorageGb > 0 ? `${recordingMaxStorageGb} GB` : "Unlimited";
  let usageLabel = usageError
    ? "Recording storage usage is unavailable"
    : "Loading recording storage usage";
  if (usedBytes !== null && usageError) {
    usageLabel = `${usedLabel} used; storage usage may be out of date`;
  } else if (usedBytes !== null) {
    usageLabel =
      recordingMaxStorageGb > 0
        ? `${usedLabel} used of ${limitLabel}`
        : `${usedLabel} used with no storage limit`;
  }
  const isNearStorageLimit =
    recordingMaxStorageGb > 0 &&
    usedBytes !== null &&
    usagePercentage >= STORAGE_WARNING_PERCENTAGE;
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
      {isNearStorageLimit && (
        <span
          aria-label={STORAGE_WARNING_TOOLTIP}
          className="tooltip tooltip-bottom tooltip-warning no-drag inline-flex h-8 w-5 items-center justify-center text-warning"
          data-tip={STORAGE_WARNING_TOOLTIP}
          role="status"
          tabIndex={0}
        >
          <FiAlertTriangle aria-hidden="true" size={12} />
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
              aria-valuenow={usedBytes === null ? undefined : usagePercentage}
              className="relative block h-1 w-full overflow-hidden rounded-full bg-base-content/20"
              role="progressbar"
            >
              <span
                className={clsx("absolute inset-y-0 left-0", {
                  "bg-error": usagePercentage >= 100,
                  "bg-primary": usagePercentage < STORAGE_WARNING_PERCENTAGE,
                  "bg-warning":
                    usagePercentage >= STORAGE_WARNING_PERCENTAGE &&
                    usagePercentage < 100,
                })}
                style={{ width: `${usagePercentage}%` }}
              />
            </span>
          </span>
        </button>
      </span>
    </div>
  );
}

export { AppStorageUsageMeter };
