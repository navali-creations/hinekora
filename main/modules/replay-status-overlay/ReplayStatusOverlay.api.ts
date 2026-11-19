import { ipcRenderer } from "electron";

import { ReplayStatusOverlayChannel } from "./ReplayStatusOverlay.channels";
import {
  type ReplayStatusOverlayEvent,
  ReplayStatusOverlayEventSchema,
} from "./ReplayStatusOverlay.dto";

const ReplayStatusOverlayAPI = {
  getSnapshot: async (): Promise<ReplayStatusOverlayEvent | null> => {
    const snapshot: unknown = await ipcRenderer.invoke(
      ReplayStatusOverlayChannel.GetSnapshot,
    );
    const parsedSnapshot =
      ReplayStatusOverlayEventSchema.nullable().safeParse(snapshot);
    if (!parsedSnapshot.success) {
      throw new Error("Invalid replay status snapshot");
    }
    return parsedSnapshot.data;
  },
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
