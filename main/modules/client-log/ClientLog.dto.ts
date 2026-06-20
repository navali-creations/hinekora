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

export type { ClientLogStatus };
