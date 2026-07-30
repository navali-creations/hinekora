import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import {
  assertObject,
  assertString,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { StorageChannel } from "./Storage.channels";
import type {
  DeleteGameLeagueDataResult,
  StorageAnalysisAvailability,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "./Storage.dto";

interface StorageIpcActions {
  deleteGameLeagueData: (
    input: StorageGameLeagueInput,
  ) => Promise<DeleteGameLeagueDataResult>;
  getGameLeagueUsage: () => Promise<StorageGameLeagueUsage[]>;
  getAnalysisAvailability: () => StorageAnalysisAvailability;
  getInfo: () => Promise<StorageInfo>;
  revealPaths: () => StorageRevealPathsResult;
}

function setupStorageIpcHandlers(actions: StorageIpcActions): void {
  registerGuardedIpcHandler(
    StorageChannel.GetAnalysisAvailability,
    [WindowName.Main],
    () => actions.getAnalysisAvailability(),
  );
  registerGuardedIpcHandler(StorageChannel.GetInfo, [WindowName.Main], () =>
    actions.getInfo(),
  );
  registerGuardedIpcHandler(
    StorageChannel.GetGameLeagueUsage,
    [WindowName.Main],
    () => actions.getGameLeagueUsage(),
  );
  registerGuardedIpcHandler(
    StorageChannel.DeleteGameLeagueData,
    [WindowName.Main],
    async (_event, input: unknown) => {
      try {
        return await actions.deleteGameLeagueData(
          parseGameLeagueInput(input, StorageChannel.DeleteGameLeagueData),
        );
      } catch (error) {
        return {
          success: false,
          freedBytes: 0,
          deletedClipCount: 0,
          deletedRecordingCount: 0,
          error: safeErrorMessage(error),
        };
      }
    },
  );
  registerGuardedIpcHandler(StorageChannel.RevealPaths, [WindowName.Main], () =>
    actions.revealPaths(),
  );
}

function parseGameLeagueInput(
  input: unknown,
  channel: string,
): StorageGameLeagueInput {
  assertObject(input, "input", channel);
  const game = input.game;
  const leagueName = input.leagueName;
  assertString(game, "game", channel, { min: 1, max: 16 });
  assertString(leagueName, "league", channel, { min: 1, max: 80 });
  if (game !== "poe1" && game !== "poe2") {
    throw new Error("game must be poe1 or poe2");
  }

  return { game, leagueName };
}

export { setupStorageIpcHandlers };
