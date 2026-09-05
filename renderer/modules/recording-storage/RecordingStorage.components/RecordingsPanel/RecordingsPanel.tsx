import { useNavigate } from "@tanstack/react-router";
import {
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RunRecordingLibraryQuery } from "~/main/modules/recording-storage/RecordingStorage.dto";
import { MediaLibraryTable } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryTable/MediaLibraryTable";
import {
  ALL_LEAGUES_VALUE,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import {
  useManagedRecorderSelector,
  useRecordingStorageShallow,
} from "~/renderer/store";

import { TransientRunRecordingTableRow } from "../TransientRunRecordingTableRow/TransientRunRecordingTableRow";
import {
  canOpenRecordingRow,
  createTransientRunRecordingRow,
  getCellClassName,
  getHeaderClassName,
  getRecordingRowClassName,
  type RecordingTableRow,
  resolveSortBy,
  toRecordingTableRow,
} from "./RecordingsPanel.utils";
import { useRecordingsPanelColumns } from "./useRecordingsPanelColumns/useRecordingsPanelColumns";

interface RecordingsPanelProps {
  isScopeReady?: boolean;
  scope: MediaLibraryScope;
}

function RecordingsPanel({ isScopeReady = true, scope }: RecordingsPanelProps) {
  const navigate = useNavigate();
  const managedRecorderStatus = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const {
    clearSelectedRecordings,
    recordingsPage,
    recordings,
    refreshRecordings,
    rowSelection,
    setSelectedRecordingIds,
    storageError,
  } = useRecordingStorageShallow((recordingStorage) => ({
    clearSelectedRecordings: recordingStorage.clearSelectedRecordings,
    recordingsPage: recordingStorage.recordingsPage,
    recordings: recordingStorage.recordings,
    refreshRecordings: recordingStorage.refreshRecordings,
    rowSelection: recordingStorage.selectedRecordingIds,
    setSelectedRecordingIds: recordingStorage.setSelectedRecordingIds,
    storageError: recordingStorage.error,
  }));
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [now, setNow] = useState(() => new Date());
  const scopeResetKey = `${scope.game}:${scope.league}`;
  const lastScopeResetKeyRef = useRef(scopeResetKey);
  const queryPageIndex =
    scopeResetKey === lastScopeResetKeyRef.current ? pagination.pageIndex : 0;
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const isTimingRunRecording =
    managedRecorderStatus?.runRecordingSession?.state === "recording";

  useEffect(() => {
    if (!isTimingRunRecording) {
      return;
    }

    setNow(new Date());
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isTimingRunRecording]);

  const transientRunRecording = useMemo(
    () =>
      createTransientRunRecordingRow({
        now,
        scope,
        status: managedRecorderStatus,
      }),
    [managedRecorderStatus, now, scope],
  );
  const tableRecordings = useMemo<RecordingTableRow[]>(() => {
    return recordings.map(toRecordingTableRow);
  }, [recordings]);
  const totalRecordingRows = recordingsPage?.totalCount ?? recordings.length;
  const tablePageCount = Math.max(
    recordingsPage?.pageCount ?? 1,
    Math.ceil(totalRecordingRows / pagination.pageSize),
  );
  const recordingQuery = useMemo<RunRecordingLibraryQuery>(() => {
    const activeSort = sorting[0];
    const query: RunRecordingLibraryQuery = {
      game: scope.game,
      pageIndex: queryPageIndex,
      pageSize: pagination.pageSize,
      sortBy: resolveSortBy(activeSort?.id),
      sortDirection: activeSort?.desc === false ? "asc" : "desc",
    };
    if (scope.league !== ALL_LEAGUES_VALUE) {
      query.league = scope.league;
    }

    return query;
  }, [pagination.pageSize, queryPageIndex, scope.game, scope.league, sorting]);

  useEffect(() => {
    if (scopeResetKey === lastScopeResetKeyRef.current) {
      return;
    }

    lastScopeResetKeyRef.current = scopeResetKey;
    clearSelectedRecordings();
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [clearSelectedRecordings, scopeResetKey]);

  useEffect(() => {
    if (!isScopeReady) {
      return;
    }

    void refreshRecordings(recordingQuery);
  }, [isScopeReady, recordingQuery, refreshRecordings]);

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    clearSelectedRecordings();
    setPagination((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    setSelectedRecordingIds(
      typeof updater === "function" ? updater(rowSelection) : updater,
    );
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    clearSelectedRecordings();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSorting((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const handleRowClick = (recording: RecordingTableRow) => {
    void navigate({
      to: "/recording/$recordingId",
      params: { recordingId: recording.id },
    });
  };

  const renderPinnedTopRows = () =>
    transientRunRecording ? (
      <TransientRunRecordingTableRow
        recording={transientRunRecording}
        showLeagueColumn={showLeagueColumn}
      />
    ) : null;

  const columns = useRecordingsPanelColumns({ showLeagueColumn });
  const table = useReactTable({
    data: tableRecordings,
    columns,
    enableRowSelection: (row) => canOpenRecordingRow(row.original),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    pageCount: tablePageCount,
    rowCount: totalRecordingRows,
    state: { pagination, rowSelection, sorting },
  });

  return (
    <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg bg-base-200">
      <MediaLibraryTable
        emptyMessage="No recordings match this page filter."
        canRowClick={canOpenRecordingRow}
        getCellClassName={getCellClassName}
        getHeaderClassName={getHeaderClassName}
        getRowClassName={getRecordingRowClassName}
        onRowClick={handleRowClick}
        pinnedTopRowCount={transientRunRecording ? 1 : 0}
        renderPinnedTopRows={renderPinnedTopRows}
        table={table}
        totalCount={totalRecordingRows}
      />
      {storageError && (
        <p className="m-0 shrink-0 border-base-content/10 border-t px-4 py-3 text-error text-sm">
          {storageError}
        </p>
      )}
    </section>
  );
}

export { RecordingsPanel };
