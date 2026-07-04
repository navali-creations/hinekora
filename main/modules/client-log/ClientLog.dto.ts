import type { ClientLogStatus, GameId } from "~/types";

export interface ClientLogPathInput {
  game: GameId;
  path: string;
}

export interface ClientLogActiveGameInput {
  game: GameId;
}

export interface ClientLogDeathEvent {
  game: GameId;
  line: string;
  lineHash: string;
  detectedAt: string;
}

export interface ClientLogActivityBatchEvent {
  events: ClientLogActivityEvent[];
  game: GameId;
}

export type ClientLogActivityEvent =
  | {
      areaId: string;
      kind: "generated-area";
      line: string;
      occurredAt: string;
      sequenceId: string;
    }
  | {
      kind: "scene-source";
      line: string;
      occurredAt: string;
      sceneName: string;
      sequenceId: string;
    };

export type { ClientLogStatus };
