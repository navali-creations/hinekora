import {
  getCellClassName,
  getRecordingRowClassName,
  type RecordingTableRow,
  resolveRecordingTableColumnIds,
} from "../RecordingsPanel/RecordingsPanel.utils";
import { TransientRunRecordingTableCell } from "../TransientRunRecordingTableCell/TransientRunRecordingTableCell";

interface TransientRunRecordingTableRowProps {
  recording: RecordingTableRow;
  showLeagueColumn: boolean;
}

function TransientRunRecordingTableRow({
  recording,
  showLeagueColumn,
}: TransientRunRecordingTableRowProps) {
  return (
    <tr
      aria-disabled="true"
      className={getRecordingRowClassName(recording)}
      data-testid="transient-run-recording-row"
    >
      {resolveRecordingTableColumnIds(showLeagueColumn).map((columnId) => (
        <td className={getCellClassName(columnId)} key={columnId}>
          <TransientRunRecordingTableCell
            columnId={columnId}
            recording={recording}
          />
        </td>
      ))}
    </tr>
  );
}

export { TransientRunRecordingTableRow };
