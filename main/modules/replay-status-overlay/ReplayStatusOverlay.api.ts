import { ipcRenderer } from "electron";

import { ReplayStatusOverlayChannel } from "./ReplayStatusOverlay.channels";
import {
  type ReplayStatusOverlayEvent,
  ReplayStatusOverlayEventSchema,
} from "./ReplayStatusOverlay.dto";

const ReplayStatusOverlayAPI = {
  onStatusChanged: (callback: (status: ReplayStatusOverlayEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => {
      const parsedStatus = ReplayStatusOverlayEventSchema.safeParse(status);
      if (parsedStatus.success) {
        callback(parsedStatus.data);
      }
    };
    ipcRenderer.on(ReplayStatusOverlayChannel.StatusChanged, listener);

    return () =>
      ipcRenderer.removeListener(
        ReplayStatusOverlayChannel.StatusChanged,
        listener,
      );
  },
};

export { ReplayStatusOverlayAPI };
