import clsx from "clsx";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { FiTrash2 } from "react-icons/fi";

import type { StorageGameLeagueUsage } from "~/main/modules/storage/Storage.dto";

import type { GameId } from "~/types";
import { formatBytes, gameLabel } from "../storage.utils/storage.utils";

interface LeagueDataSectionProps {
  deletingGameLeagueId: string | null;
  isLoading: boolean;
  usage: StorageGameLeagueUsage[];
  onDeleteRequest: (usage: StorageGameLeagueUsage) => void;
}

function LeagueDataSection({
  deletingGameLeagueId,
  isLoading,
  usage,
  onDeleteRequest,
}: LeagueDataSectionProps) {
  const [activeGame, setActiveGame] = useState<GameId>("poe1");
  const poe1Usage = useMemo(
    () => usage.filter((item) => item.game === "poe1"),
    [usage],
  );
  const poe2Usage = useMemo(
    () => usage.filter((item) => item.game === "poe2"),
    [usage],
  );
  const hasPoe1 = poe1Usage.length > 0;
  const hasPoe2 = poe2Usage.length > 0;
  const activeUsage = activeGame === "poe1" ? poe1Usage : poe2Usage;

  useEffect(() => {
    if (!hasPoe1 && hasPoe2) {
      setActiveGame("poe2");
    }
  }, [hasPoe1, hasPoe2]);

  const handleGameTabClick = (event: MouseEvent<HTMLButtonElement>) => {
    const game = event.currentTarget.dataset.game;
    if (game === "poe1" || game === "poe2") {
      setActiveGame(game);
    }
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.dataset.id;
    const item = usage.find((usageItem) => usageItem.id === id);
    if (item) {
      onDeleteRequest(item);
    }
  };

  return (
    <div className="space-y-3">
      <span className="font-semibold text-sm">League Data</span>

      {usage.length === 0 && !isLoading && (
        <p className="py-3 text-base-content/50 text-sm">
          No league data to clean up
        </p>
      )}

      {usage.length > 0 && (
        <div className="space-y-3">
          {hasPoe1 && hasPoe2 && (
            <div
              className="tabs tabs-box tabs-sm w-fit bg-base-200"
              role="tablist"
            >
              <button
                className={clsx("tab", activeGame === "poe1" && "tab-active")}
                data-game="poe1"
                role="tab"
                type="button"
                onClick={handleGameTabClick}
              >
                PoE1
                <span className="badge badge-ghost badge-xs ml-1.5">
                  {poe1Usage.length}
                </span>
              </button>
              <button
                className={clsx("tab", activeGame === "poe2" && "tab-active")}
                data-game="poe2"
                role="tab"
                type="button"
                onClick={handleGameTabClick}
              >
                PoE2
                <span className="badge badge-ghost badge-xs ml-1.5">
                  {poe2Usage.length}
                </span>
              </button>
            </div>
          )}

          {hasPoe1 !== hasPoe2 && (
            <p className="text-base-content/50 text-xs">
              {gameLabel(hasPoe1 ? "poe1" : "poe2")}
            </p>
          )}

          <div className="rounded-lg bg-base-100 p-2">
            <div className="overflow-x-auto">
              <table className="table rounded-0 bg-base-100 [&_tbody_td]:py-1 [&_tbody_td]:text-xs">
                <thead>
                  <tr>
                    <th>League</th>
                    <th className="pl-0 text-center">Clips</th>
                    <th className="pl-0 text-center">Recordings</th>
                    <th className="pl-0 text-center">Size</th>
                    <th className="pl-0 text-center" />
                  </tr>
                </thead>
                <tbody>
                  {activeUsage.map((item) => {
                    const isDeleting = deletingGameLeagueId === item.id;

                    return (
                      <tr className="group hover" key={item.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.leagueName}</span>
                            {item.hasActiveRecording && (
                              <span className="badge badge-success badge-xs">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="pl-0 text-center">
                          <span className="text-sm tabular-nums">
                            {item.clipCount}
                          </span>
                        </td>
                        <td className="pl-0 text-center">
                          <span className="text-sm tabular-nums">
                            {item.recordingCount}
                          </span>
                        </td>
                        <td className="pl-0 text-center">
                          <span className="text-base-content/60 text-xs tabular-nums">
                            ~{formatBytes(item.estimatedSizeBytes)}
                          </span>
                        </td>
                        <td className="pl-0 text-center">
                          <button
                            className="btn btn-ghost btn-square btn-xs text-error disabled:text-error/30"
                            data-id={item.id}
                            disabled={item.hasActiveRecording || isDeleting}
                            title={`Delete all data for ${item.leagueName}`}
                            type="button"
                            onClick={handleDeleteClick}
                          >
                            {isDeleting ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <FiTrash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeagueDataSection;
