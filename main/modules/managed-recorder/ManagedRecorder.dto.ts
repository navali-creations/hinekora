import type { ManagedRecorderStatus } from "~/types";

export type ManagedReplayKind = "death" | "manual";

export interface ManagedReplaySaveResult {
  ok: boolean;
  path: string | null;
  error: string | null;
}

export type { ManagedRecorderStatus };
