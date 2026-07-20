enum EditorChannel {
  CancelExport = "editor:cancel-export",
  CopyExport = "editor:copy-export",
  CopyProjectToClipboard = "editor:copy-project-to-clipboard",
  CreateProject = "editor:create-project",
  DeleteAllProjects = "editor:delete-all-projects",
  DeleteProject = "editor:delete-project",
  DismissExport = "editor:dismiss-export",
  ExportLifecycleChanged = "editor:export-lifecycle-changed",
  ExportProgress = "editor:export-progress",
  ExportProject = "editor:export-project",
  GetExportLifecycle = "editor:get-export-lifecycle",
  GetWorkspace = "editor:get-workspace",
  ListMediaAssets = "editor:list-media-assets",
  RevealExport = "editor:reveal-export",
  SaveProject = "editor:save-project",
}

export { EditorChannel };
