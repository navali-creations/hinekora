import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { EditorChannel } from "./Editor.channels";
import type {
  EditorCancelExportInput,
  EditorCancelExportResult,
  EditorCopyToClipboardInput,
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportLifecycle,
  EditorExportLifecycleUpdate,
  EditorExportProgress,
  EditorExportResult,
  EditorMediaAssetPage,
  EditorMediaAssetPageQuery,
  EditorProject,
  EditorSaveProjectInput,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "./Editor.dto";

const EditorAPI = {
  cancelExport: (
    input: EditorCancelExportInput,
  ): Promise<EditorCancelExportResult> =>
    ipcRenderer.invoke(EditorChannel.CancelExport, input).then(unwrapIpcResult),
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
  dismissExport: (): Promise<void> =>
    ipcRenderer.invoke(EditorChannel.DismissExport).then(unwrapIpcResult),
  exportProject: (input: EditorExportInput): Promise<EditorExportResult> =>
    ipcRenderer
      .invoke(EditorChannel.ExportProject, input)
      .then(unwrapIpcResult),
  getExportLifecycle: (): Promise<EditorExportLifecycle> =>
    ipcRenderer.invoke(EditorChannel.GetExportLifecycle).then(unwrapIpcResult),
  getWorkspace: (query?: EditorWorkspaceQuery): Promise<EditorWorkspace> =>
    ipcRenderer.invoke(EditorChannel.GetWorkspace, query).then(unwrapIpcResult),
  listMediaAssets: (
    query: EditorMediaAssetPageQuery,
  ): Promise<EditorMediaAssetPage> =>
    ipcRenderer
      .invoke(EditorChannel.ListMediaAssets, query)
      .then(unwrapIpcResult),
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
  onExportLifecycleChanged: (
    callback: (lifecycle: EditorExportLifecycleUpdate) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      lifecycle: EditorExportLifecycleUpdate,
    ) => {
      callback(lifecycle);
    };
    ipcRenderer.on(EditorChannel.ExportLifecycleChanged, listener);

    return () => {
      ipcRenderer.removeListener(
        EditorChannel.ExportLifecycleChanged,
        listener,
      );
    };
  },
};

export { EditorAPI };
