import type { StateBundle, StateImportMode, StateImportPreview } from "~/types";

export interface StateTransferResult {
  ok: boolean;
  path: string | null;
  error: string | null;
}

export interface StateImportResult {
  ok: boolean;
  backupPath: string | null;
  error: string | null;
}

export type { StateBundle, StateImportMode, StateImportPreview };
