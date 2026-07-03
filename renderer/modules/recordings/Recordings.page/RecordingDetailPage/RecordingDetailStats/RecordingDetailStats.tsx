import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import {
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

interface RecordingDetailStatsProps {
  recording: RunRecordingDetail["recording"];
}

function RecordingDetailStats({ recording }: RecordingDetailStatsProps) {
  return (
    <section className="grid gap-4 rounded-lg bg-base-200 p-4 md:grid-cols-4">
      <div>
        <div className="text-base-content/55 text-xs">Saved</div>
        <div className="font-semibold text-sm">
          {formatDateTime(recording.createdAt)}
        </div>
      </div>
      <div>
        <div className="text-base-content/55 text-xs">Length</div>
        <div className="font-semibold text-sm">
          {formatDurationSeconds(recording.durationSeconds)}
        </div>
      </div>
      <div>
        <div className="text-base-content/55 text-xs">Size</div>
        <div className="font-semibold text-sm">
          {formatBytes(recording.sizeBytes)}
        </div>
      </div>
      <div>
        <div className="text-base-content/55 text-xs">File</div>
        <div className="truncate font-semibold text-sm">
          {recording.exists ? "Available" : "Missing"}
        </div>
      </div>
    </section>
  );
}

export { RecordingDetailStats };
