import { FiAlertTriangle as AlertTriangle } from "react-icons/fi";

import { formatBytes } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useRecordingStorageSelector } from "~/renderer/store";

function DiskSpaceWarning() {
  const usage = useRecordingStorageSelector(
    (recordingStorage) => recordingStorage.usage,
  );

  if (!usage?.lowDiskSpace) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 border-warning/50 border-b bg-warning px-4 py-2 font-bold text-sm text-warning-content"
      role="status"
    >
      <AlertTriangle size={16} />
      <span>
        Low disk space: {formatBytes(usage.diskFreeBytes)} free in the recording
        folder.
      </span>
    </div>
  );
}

export { DiskSpaceWarning };
