import { formatDurationSeconds } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import {
  getCellClassName,
  getRecordingRowClassName,
  type RecordingTableColumnId,
  type RecordingTableRow,
  resolveRecordingTableColumnIds,
} from "../RecordingsPanel/RecordingsPanel.utils";
import { RecordingTableActions } from "../RecordingTableActions/RecordingTableActions";

interface ProcessingRecordingTableRowProps {
  recording: RecordingTableRow;
  showLeagueColumn: boolean;
}

function ProcessingRecordingTableRow({
  recording,
  showLeagueColumn,
}: ProcessingRecordingTableRowProps) {
  return (
    <tr
      aria-disabled="true"
      className={getRecordingRowClassName(recording)}
      data-testid="processing-recording-row"
    >
      {resolveRecordingTableColumnIds(showLeagueColumn).map((columnId) => (
        <td className={getCellClassName(columnId)} key={columnId}>
          {renderProcessingRecordingCell(recording, columnId)}
        </td>
      ))}
    </tr>
  );
}

function renderProcessingRecordingCell(
  recording: RecordingTableRow,
  columnId: RecordingTableColumnId,
) {
  switch (columnId) {
    case "select":
      return (
        <input
          aria-label="Active recording cannot be selected yet"
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
      return <span className="badge badge-warning badge-xs">Processing</span>;
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

export { ProcessingRecordingTableRow };
