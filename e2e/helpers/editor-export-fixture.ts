import type { EditorExportLifecycle } from "../../main/modules/editor";

function createIdleEditorExportLifecycle(): EditorExportLifecycle {
  return {
    canCancel: false,
    error: null,
    exportRequestId: null,
    fileName: null,
    previewClips: [],
    progress: 0,
    projectId: null,
    result: null,
    startedAt: null,
    status: "idle",
  };
}

export { createIdleEditorExportLifecycle };
