import { ipcRenderer } from "electron";

import { DiagLogChannel } from "./DiagLog.channels";
import type {
  ClipPreviewDiagnosticInput,
  DiagLogRevealResult,
} from "./DiagLog.dto";

const DiagLogAPI = {
  writeClipPreviewEvent: (input: ClipPreviewDiagnosticInput): void => {
    void ipcRenderer
      .invoke(DiagLogChannel.ClipPreviewEvent, input)
      .catch(() => undefined);
  },
  revealLogFile: (): Promise<DiagLogRevealResult> =>
    ipcRenderer.invoke(DiagLogChannel.RevealLogFile),
};

export { DiagLogAPI };
