enum MainWindowChannel {
  Close = "main-window:close",
  Maximize = "main-window:maximize",
  Minimize = "main-window:minimize",
  Unmaximize = "main-window:unmaximize",
  IsMaximized = "main-window:is-maximized",
  OpenEditorClip = "main-window:open-editor-clip",
  OpenClip = "main-window:open-clip",
  RendererReady = "main-window:renderer-ready",
}

export { MainWindowChannel };
