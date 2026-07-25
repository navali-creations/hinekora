import type { StorageExportVolume } from "~/main/modules/storage/Storage.dto";

import { DiskUsageBar } from "../DiskUsageBar/DiskUsageBar";

interface ExportVolumeDiskUsageBarProps {
  isRevealed: boolean;
  onRevealToggle: () => void;
  revealedPath: string | undefined;
  volume: StorageExportVolume;
}

function ExportVolumeDiskUsageBar({
  isRevealed,
  onRevealToggle,
  revealedPath,
  volume,
}: ExportVolumeDiskUsageBarProps) {
  const otherDiskUsedBytes = Math.max(
    0,
    volume.diskTotalBytes - volume.diskFreeBytes - volume.exportVideosSizeBytes,
  );

  return (
    <DiskUsageBar
      isRevealed={isRevealed}
      path={isRevealed ? (revealedPath ?? volume.path) : volume.path}
      segments={[
        {
          label: "Other disk usage",
          bytes: otherDiskUsedBytes,
          colorClass: "bg-base-content/20",
        },
        {
          label: "Hinekora Exports",
          bytes: volume.exportVideosSizeBytes,
          colorClass: "bg-sky-400",
        },
      ]}
      totalBytes={volume.diskTotalBytes}
      onRevealToggle={onRevealToggle}
    />
  );
}

export { ExportVolumeDiskUsageBar };
