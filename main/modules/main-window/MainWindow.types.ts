enum WindowName {
  Main = "main",
  RecorderOverlay = "recorder-overlay",
  ClipPreviewOverlay = "clip-preview-overlay",
  AuraOverlay = "aura-overlay",
  CropSelectorOverlay = "crop-selector-overlay",
}

type MainWindowOpenEditorClipOptions =
  | {
      title?: string | null;
      trim: {
        inSeconds: number;
        outSeconds: number;
      };
    }
  | {
      title?: null;
      trim?: null;
    };

export type { MainWindowOpenEditorClipOptions };
export { WindowName };
