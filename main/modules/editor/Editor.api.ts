import { ipcRenderer } from "electron";

import { EditorChannel } from "./Editor.channels";
import type {
  EditorCopyToClipboardInput,
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportProgress,
  EditorExportResult,
  EditorProject,
  EditorSaveProjectInput,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "./Editor.dto";

interface IpcValidationFailure {
  error: string;
  ok: false;
}

function unwrapIpcResult<T>(result: T | IpcValidationFailure): T {
  if (typeof result === "object" && result !== null) {
    const maybeFailure = result as Partial<IpcValidationFailure>;
    if (maybeFailure.ok === false) {
      throw new Error(maybeFailure.error ?? "Operation failed");
    }
  }

  return result as T;
}

const EditorAPI = {
  copyExport: (exportId: string): Promise<EditorExportFileActionResult> =>
    ipcRenderer.invoke(EditorChannel.CopyExport, exportId),
  copyProjectToClipboard: (
    input: EditorCopyToClipboardInput,
  ): Promise<EditorExportFileActionResult> =>
    ipcRenderer.invoke(EditorChannel.CopyProjectToClipboard, input),
  createProject: (input?: EditorCreateProjectInput): Promise<EditorProject> =>
    ipcRenderer
      .invoke(EditorChannel.CreateProject, input)
      .then(unwrapIpcResult),
  deleteAllProjects: (): Promise<EditorWorkspace> =>
    ipcRenderer.invoke(EditorChannel.DeleteAllProjects).then(unwrapIpcResult),
  deleteProject: (projectId: string): Promise<EditorWorkspace> =>
    ipcRenderer
      .invoke(EditorChannel.DeleteProject, projectId)
      .then(unwrapIpcResult),
  exportProject: (input: EditorExportInput): Promise<EditorExportResult> =>
    ipcRenderer
      .invoke(EditorChannel.ExportProject, input)
      .then(unwrapIpcResult),
  getWorkspace: (query?: EditorWorkspaceQuery): Promise<EditorWorkspace> =>
    ipcRenderer.invoke(EditorChannel.GetWorkspace, query).then(unwrapIpcResult),
  revealExport: (exportId: string): Promise<EditorExportFileActionResult> =>
    ipcRenderer.invoke(EditorChannel.RevealExport, exportId),
  saveProject: (input: EditorSaveProjectInput): Promise<EditorProject> =>
    ipcRenderer.invoke(EditorChannel.SaveProject, input).then(unwrapIpcResult),
  onExportProgress: (callback: (progress: EditorExportProgress) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: EditorExportProgress,
    ) => {
      callback(progress);
    };
    ipcRenderer.on(EditorChannel.ExportProgress, listener);

    return () => {
      ipcRenderer.removeListener(EditorChannel.ExportProgress, listener);
    };
  },
};

export { EditorAPI };
