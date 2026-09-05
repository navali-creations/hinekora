import { formatDurationSeconds } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import type {
  RecordingTableColumnId,
  RecordingTableRow,
} from "../RecordingsPanel/RecordingsPanel.utils";
import {
  formatRecordingTableStatus,
  getRecordingTableStatusBadgeClassName,
} from "../RecordingsPanel/RecordingsPanel.utils";
import { RecordingTableActions } from "../RecordingTableActions/RecordingTableActions";

interface TransientRunRecordingTableCellProps {
  columnId: RecordingTableColumnId;
  recording: RecordingTableRow;
}

function TransientRunRecordingTableCell({
  columnId,
  recording,
}: TransientRunRecordingTableCellProps) {
  switch (columnId) {
    case "select":
      return (
        <input
          aria-label="Recording cannot be selected yet"
          className="checkbox checkbox-sm"
          disabled
          type="checkbox"
        />
      );
    case "fileName":
      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate" title={recording.path}>
            {recording.fileName}
          </span>
        </div>
      );
    case "tableStatus":
      return (
        <span
          className={getRecordingTableStatusBadgeClassName(
            recording.tableStatus,
          )}
        >
          {formatRecordingTableStatus(recording.tableStatus)}
        </span>
      );
    case "createdAt":
    case "sizeBytes":
      return "--";
    case "sourceLeague":
      return recording.sourceLeague;
    case "durationSeconds":
      return formatDurationSeconds(recording.durationSeconds);
    case "actions":
      return <RecordingTableActions disabled recording={recording} />;
  }
}

export { TransientRunRecordingTableCell };
