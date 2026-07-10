interface DiagLogRevealResult {
  error?: string;
  success: boolean;
}

type ClipPreviewDiagnosticEvent =
  | "clip-state"
  | "document-state"
  | "media-event"
  | "media-source"
  | "overlay-mounted"
  | "overlay-unmounted"
  | "playback-health"
  | "trim-state"
  | "workflow-state";

type ClipPreviewDiagnosticFieldValue = boolean | number | string | null;

interface ClipPreviewDiagnosticInput {
  event: ClipPreviewDiagnosticEvent;
  fields?: Record<string, ClipPreviewDiagnosticFieldValue>;
}

export type {
  ClipPreviewDiagnosticEvent,
  ClipPreviewDiagnosticFieldValue,
  ClipPreviewDiagnosticInput,
  DiagLogRevealResult,
};
