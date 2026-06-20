import { useNavigate } from "@tanstack/react-router";
import { TbDatabaseExclamation } from "react-icons/tb";

import { useRecordingStorageSelector } from "~/renderer/store";

const APPBAR_ICON_SIZE = 16;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const DiskSpaceWarning = () => {
  const usage = useRecordingStorageSelector(
    (recordingStorage) => recordingStorage.usage,
  );
  const navigate = useNavigate();

  const handleOpenStorageSettings = () => {
    void navigate({ to: "/settings" });
  };

  if (!usage?.lowDiskSpace) {
    return null;
  }

  const tooltip = `Low disk space - ${formatBytes(usage.diskFreeBytes)} free`;

  return (
    <div className="tooltip tooltip-bottom tooltip-warning" data-tip={tooltip}>
      <button
        type="button"
        onClick={handleOpenStorageSettings}
        className="no-drag btn btn-ghost btn-sm text-warning"
      >
        <TbDatabaseExclamation size={APPBAR_ICON_SIZE} />
      </button>
    </div>
  );
};

export default DiskSpaceWarning;
