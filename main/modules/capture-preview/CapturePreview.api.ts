import { ipcRenderer } from "electron";

import type { CapturePreviewSource } from "~/types";
import { CapturePreviewChannel } from "./CapturePreview.channels";

const CapturePreviewAPI = {
  listSources: (forceRefresh?: boolean): Promise<CapturePreviewSource[]> =>
    ipcRenderer.invoke(CapturePreviewChannel.ListSources, forceRefresh),
  sourceExists: (sourceId: string): Promise<boolean> =>
    ipcRenderer.invoke(CapturePreviewChannel.SourceExists, sourceId),
};

export { CapturePreviewAPI };
