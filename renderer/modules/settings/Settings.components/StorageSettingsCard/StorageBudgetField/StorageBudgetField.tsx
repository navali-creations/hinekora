import type { ChangeEvent } from "react";
import { useEffect, useId, useState } from "react";
import { FiInfo } from "react-icons/fi";

import { useSettingsShallow, useStorageShallow } from "~/renderer/store";

import {
  type AppSettingsUpdate,
  defaultEditorExportMaxStorageGb,
  defaultRecordingMaxStorageGb,
  storageBytesPerGigabyte,
} from "~/types";
import { StorageBudgetReductionConfirmationModal } from "../StorageBudgetReductionConfirmationModal/StorageBudgetReductionConfirmationModal";
import { getStorageSettingsError } from "../StorageSettingsCard.utils";

type StorageBudgetSettingKey =
  | "editorExportMaxStorageGb"
  | "recordingMaxStorageGb";

interface StorageBudgetFieldProps {
  currentUsageBytes?: number | null;
  currentUsageIsPartial?: boolean;
  disabled: boolean;
  helpText: string;
  settingKey: StorageBudgetSettingKey;
}

interface PendingBudgetReduction {
  currentUsageBytes: number | null;
  currentUsageIsPartial: boolean;
  nextLimitGb: number;
}

const defaults: Record<StorageBudgetSettingKey, number> = {
  editorExportMaxStorageGb: defaultEditorExportMaxStorageGb,
  recordingMaxStorageGb: defaultRecordingMaxStorageGb,
};

function StorageBudgetField({
  currentUsageBytes,
  currentUsageIsPartial = false,
  disabled,
  helpText,
  settingKey,
}: StorageBudgetFieldProps) {
  const { persistedValue, updateSettings } = useSettingsShallow((settings) => ({
    persistedValue: settings.value?.[settingKey] ?? defaults[settingKey],
    updateSettings: settings.update,
  }));
  const setError = useStorageShallow((storage) => storage.setError);
  const [draft, setDraft] = useState(String(persistedValue));
  const [pendingReduction, setPendingReduction] =
    useState<PendingBudgetReduction | null>(null);
  const inputId = useId();

  useEffect(() => {
    setDraft(String(persistedValue));
    setPendingReduction(null);
  }, [persistedValue]);
  useEffect(() => {
    if (disabled) {
      setDraft(String(persistedValue));
      setPendingReduction(null);
    }
  }, [disabled, persistedValue]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };
  const persistValue = async (nextValue: number) => {
    try {
      setError(null);
      await updateSettings({ [settingKey]: nextValue } as AppSettingsUpdate);
    } catch (error) {
      setDraft(String(persistedValue));
      setError(getStorageSettingsError(error));
    }
  };
  const handleCommit = () => {
    void (async () => {
      const trimmedValue = draft.trim();
      const parsedValue = Number(trimmedValue);
      if (trimmedValue.length === 0 || !Number.isFinite(parsedValue)) {
        setDraft(String(persistedValue));
        return;
      }
      const nextValue = Math.max(0, Math.round(parsedValue));
      setDraft(String(nextValue));
      if (nextValue === persistedValue) {
        return;
      }
      const isLimitReduction =
        nextValue > 0 && (persistedValue === 0 || nextValue < persistedValue);
      const normalizedUsageBytes =
        currentUsageBytes !== undefined &&
        currentUsageBytes !== null &&
        Number.isFinite(currentUsageBytes) &&
        currentUsageBytes >= 0
          ? currentUsageBytes
          : null;
      if (
        currentUsageBytes !== undefined &&
        isLimitReduction &&
        (currentUsageIsPartial ||
          normalizedUsageBytes === null ||
          normalizedUsageBytes > nextValue * storageBytesPerGigabyte)
      ) {
        setPendingReduction({
          currentUsageBytes: normalizedUsageBytes,
          currentUsageIsPartial,
          nextLimitGb: nextValue,
        });
        return;
      }
      await persistValue(nextValue);
    })();
  };
  const handleReductionCancel = () => {
    setPendingReduction(null);
    setDraft(String(persistedValue));
  };
  const handleReductionConfirm = (nextValue: number) => {
    setPendingReduction(null);
    void persistValue(nextValue);
  };

  return (
    <>
      <div className="grid content-start gap-1.5 text-primary text-[0.8125rem]">
        <span className="inline-flex items-center gap-1">
          <label htmlFor={inputId}>Max storage GB</label>
          <span
            aria-label={helpText}
            className="tooltip tooltip-left inline-flex cursor-help text-base-content/45 transition-colors hover:text-base-content/70"
            data-tip={helpText}
            role="img"
            tabIndex={0}
          >
            <FiInfo className="h-3.5 w-3.5" />
          </span>
        </span>
        <input
          id={inputId}
          className="input input-bordered input-sm w-full"
          disabled={disabled}
          max={100_000}
          min={0}
          step={1}
          type="number"
          value={draft}
          onBlur={handleCommit}
          onChange={handleChange}
        />
      </div>
      {pendingReduction && (
        <StorageBudgetReductionConfirmationModal
          currentUsageBytes={pendingReduction.currentUsageBytes}
          currentUsageIsPartial={pendingReduction.currentUsageIsPartial}
          kind={settingKey === "recordingMaxStorageGb" ? "recording" : "export"}
          nextLimitGb={pendingReduction.nextLimitGb}
          onCancel={handleReductionCancel}
          onConfirm={() => handleReductionConfirm(pendingReduction.nextLimitGb)}
        />
      )}
    </>
  );
}

export { StorageBudgetField };
