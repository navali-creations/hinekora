import { ipcRenderer } from "electron";

import { DiagLogChannel } from "./DiagLog.channels";
import type { DiagLogRevealResult } from "./DiagLog.dto";

const DiagLogAPI = {
  revealLogFile: (): Promise<DiagLogRevealResult> =>
    ipcRenderer.invoke(DiagLogChannel.RevealLogFile),
};

export { DiagLogAPI };
