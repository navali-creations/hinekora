import type {
  EditorExportLifecycleUpdate,
  EditorExportProgress,
} from "~/main/modules/editor";

import { initialExportState } from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorExportNoticeId } from "./Editor.slice.types";

const editorExportNoticeIds: EditorExportNoticeId[] = [
  "cancel-without-leftovers",
  "keep-editing-safely",
  "keep-using-hinekora",
];
const editorExportNoticeStoragePrefix = "hinekora:editor-export-notices:";

function applyExportLifecycle(
  set: EditorSliceActionContext["set"],
  lifecycle: EditorExportLifecycleUpdate,
): void {
  const persistedNoticeIds = lifecycle.exportRequestId
    ? readDismissedExportNoticeIds(lifecycle.exportRequestId)
    : [];
  let completedRequestId: string | null = null;
  set((state) => {
    const current = state.editor.exportState;
    const isCurrentRequest =
      lifecycle.exportRequestId !== null &&
      current.requestId === lifecycle.exportRequestId;

    if (lifecycle.status === "idle") {
      completedRequestId = current.requestId;
      state.editor.exportState = initialExportState;
      return;
    }

    const isViewOpen = isCurrentRequest ? current.isViewOpen : true;
    if (lifecycle.status === "exporting") {
      state.editor.exportState = {
        canCancel: lifecycle.canCancel === true,
        dismissedNoticeIds: isCurrentRequest
          ? current.dismissedNoticeIds
          : persistedNoticeIds,
        error: null,
        fileName: lifecycle.fileName,
        isCancelConfirmationOpen:
          lifecycle.canCancel === true && isCurrentRequest
            ? current.isCancelConfirmationOpen
            : false,
        isCancellationPending:
          lifecycle.canCancel === true && isCurrentRequest
            ? current.isCancellationPending
            : false,
        isViewOpen,
        previewClips:
          lifecycle.previewClips ??
          (isCurrentRequest ? current.previewClips : []),
        progress: isCurrentRequest
          ? Math.max(current.progress, lifecycle.progress)
          : lifecycle.progress,
        projectId: lifecycle.projectId,
        requestId: lifecycle.exportRequestId,
        result: null,
        startedAt: lifecycle.startedAt ?? null,
        status: "exporting",
      };
      return;
    }

    state.editor.exportState = {
      canCancel: false,
      dismissedNoticeIds: isCurrentRequest ? current.dismissedNoticeIds : [],
      error: lifecycle.error,
      fileName: lifecycle.fileName,
      isCancelConfirmationOpen: false,
      isCancellationPending: false,
      isViewOpen,
      previewClips: lifecycle.previewClips ?? [],
      progress: lifecycle.status === "ready" ? 1 : 0,
      projectId: lifecycle.projectId,
      requestId: lifecycle.exportRequestId,
      result: lifecycle.result,
      startedAt: lifecycle.startedAt ?? null,
      status: lifecycle.status,
    };
    completedRequestId = lifecycle.exportRequestId;
  });
  if (completedRequestId) {
    clearDismissedExportNoticeIds(completedRequestId);
  }
}

function applyExportProgress(
  set: EditorSliceActionContext["set"],
  progress: EditorExportProgress,
): void {
  set((state) => {
    if (
      state.editor.exportState.status !== "exporting" ||
      state.editor.exportState.requestId !== progress.exportRequestId
    ) {
      return;
    }
    state.editor.exportState.progress = Math.max(
      state.editor.exportState.progress,
      Math.min(Math.max(progress.progress, 0), 0.98),
    );
  });
}

function clearDismissedExportNoticeIds(exportRequestId: string): void {
  try {
    window.sessionStorage.removeItem(
      `${editorExportNoticeStoragePrefix}${exportRequestId}`,
    );
  } catch {
    // Dismissal remains active in memory when session storage is unavailable.
  }
}

function persistDismissedExportNoticeIds(
  exportRequestId: string,
  noticeIds: EditorExportNoticeId[],
): void {
  try {
    window.sessionStorage.setItem(
      `${editorExportNoticeStoragePrefix}${exportRequestId}`,
      JSON.stringify(noticeIds),
    );
  } catch {
    // Dismissal remains active in memory when session storage is unavailable.
  }
}

function readDismissedExportNoticeIds(
  exportRequestId: string,
): EditorExportNoticeId[] {
  try {
    const storedValue = window.sessionStorage.getItem(
      `${editorExportNoticeStoragePrefix}${exportRequestId}`,
    );
    if (!storedValue) {
      return [];
    }
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return editorExportNoticeIds.filter((noticeId) =>
      parsedValue.includes(noticeId),
    );
  } catch {
    return [];
  }
}

export {
  applyExportLifecycle,
  applyExportProgress,
  clearDismissedExportNoticeIds,
  persistDismissedExportNoticeIds,
};
