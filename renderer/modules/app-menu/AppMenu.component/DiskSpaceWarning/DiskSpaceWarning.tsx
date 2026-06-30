import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect } from "react";
import { TbDatabaseExclamation } from "react-icons/tb";

import { useStorageShallow } from "~/renderer/store";

import { appbarButtonClass } from "../AppMenu.utils";

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
  const { checkDiskSpace, diskFreeBytes, isDiskLow } = useStorageShallow(
    (storage) => ({
      checkDiskSpace: storage.checkDiskSpace,
      diskFreeBytes: storage.diskFreeBytes,
      isDiskLow: storage.isDiskLow,
    }),
  );
  const navigate = useNavigate();

  useEffect(() => {
    void checkDiskSpace();
  }, [checkDiskSpace]);

  const handleOpenStorageSettings = () => {
    void navigate({ to: "/settings" });
  };

  if (!isDiskLow) {
    return null;
  }

  const tooltip = `Low disk space - ${formatBytes(diskFreeBytes ?? 0)} free`;

  return (
    <div className="tooltip tooltip-bottom tooltip-warning" data-tip={tooltip}>
      <button
        type="button"
        onClick={handleOpenStorageSettings}
        className={clsx(appbarButtonClass, "text-warning")}
      >
        <TbDatabaseExclamation size={APPBAR_ICON_SIZE} />
      </button>
    </div>
  );
};

export default DiskSpaceWarning;
