enum WindowName {
  Main = "main",
  RecorderOverlay = "recorder-overlay",
  ClipPreviewOverlay = "clip-preview-overlay",
  AuraOverlay = "aura-overlay",
  CropSelectorOverlay = "crop-selector-overlay",
}

interface MainWindowOpenEditorClipOptions {
  title?: string | null;
  trim?: {
    inSeconds: number;
    outSeconds: number;
  } | null;
}

export type { MainWindowOpenEditorClipOptions };
export { WindowName };
