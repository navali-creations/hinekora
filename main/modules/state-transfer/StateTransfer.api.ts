import { ipcRenderer } from "electron";

import type { StateImportMode, StateImportPreview } from "~/types";
import { StateTransferChannel } from "./StateTransfer.channels";
import type {
  StateImportResult,
  StateTransferResult,
} from "./StateTransfer.dto";

const StateTransferAPI = {
  exportPortable: (): Promise<StateTransferResult> =>
    ipcRenderer.invoke(StateTransferChannel.ExportPortable),
  previewImport: (): Promise<StateImportPreview | null> =>
    ipcRenderer.invoke(StateTransferChannel.PreviewImport),
  importPortable: (mode: StateImportMode): Promise<StateImportResult> =>
    ipcRenderer.invoke(StateTransferChannel.ImportPortable, mode),
};

export { StateTransferAPI };
