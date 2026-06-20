import { useState } from "react";
import {
  FiEye as Eye,
  FiEyeOff as EyeOff,
  FiFolder as FolderOpen,
} from "react-icons/fi";

import { useClientLogShallow, useSettingsSelector } from "~/renderer/store";

import type { GameId } from "~/types";

const clientLogFields: Array<{ game: GameId; label: string }> = [
  { game: "poe1", label: "Path of Exile 1 Client.txt" },
  { game: "poe2", label: "Path of Exile 2 Client.txt" },
];

function maskClientPath(fullPath: string): string {
  if (!fullPath) {
    return "";
  }

  const normalized = fullPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const separator = fullPath.includes("\\") ? "\\" : "/";
  const root = parts[0];
  const anchors = new Set(["path of exile", "path of exile 2"]);

  const anchorIndex = parts.findIndex(
    (part, index) => index > 0 && anchors.has(part.toLowerCase()),
  );

  if (anchorIndex > 1) {
    return [root, "**", ...parts.slice(anchorIndex)].join(separator);
  }

  if (parts.length > 3) {
    return [root, "**", ...parts.slice(-3)].join(separator);
  }

  return fullPath;
}

function GameLogSettingsCard() {
  const { saveGamePath, status } = useClientLogShallow((clientLog) => ({
    saveGamePath: clientLog.saveGamePath,
    status: clientLog.status,
  }));
  const settingsValue = useSettingsSelector((settings) => settings.value);
  const [revealedPaths, setRevealedPaths] = useState<
    Partial<Record<GameId, boolean>>
  >({});

  const paths: Record<GameId, string> = {
    poe1: settingsValue?.poe1ClientTxtPath ?? "",
    poe2: settingsValue?.poe2ClientTxtPath ?? "",
  };

  const togglePathReveal = (game: GameId) => {
    setRevealedPaths((current) => ({
      ...current,
      [game]: !current[game],
    }));
  };

  const handleBrowsePath = async (game: GameId) => {
    const filePath = await window.electron.app.selectPath({
      title: "Select Path of Exile Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await saveGamePath(game, filePath);
    }
  };

  return (
    <section className="grid max-w-xl gap-4">
      <p className="sr-only">
        Configure paths to your Path of Exile client logs
      </p>
      {clientLogFields.map((field) => {
        const path = paths[field.game];
        const isRevealed = revealedPaths[field.game] === true;
        const displayPath = isRevealed ? path : maskClientPath(path);

        return (
          <div className="space-y-2" key={field.game}>
            <div>
              <h3 className="m-0 font-semibold text-base-content/80 text-sm">
                {field.label}
              </h3>
              <p className="m-0 text-base-content/50 text-xs">
                Client.txt location
              </p>
            </div>
            <div className="join w-full">
              <label className="input input-bordered input-sm join-item flex min-w-0 flex-1 items-center">
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  placeholder="No file selected"
                  readOnly
                  title={path || undefined}
                  type="text"
                  value={displayPath}
                />
              </label>
              {path && (
                <button
                  aria-label={
                    isRevealed ? "Hide full path" : "Reveal full path"
                  }
                  aria-pressed={isRevealed}
                  className="btn btn-ghost btn-sm btn-square join-item text-base-content/50 hover:text-base-content/80"
                  title={isRevealed ? "Hide full path" : "Reveal full path"}
                  type="button"
                  onClick={() => togglePathReveal(field.game)}
                >
                  {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
              <button
                aria-label={`Select ${field.label}`}
                className="no-drag btn btn-primary btn-sm btn-square join-item"
                title={`Select ${field.label}`}
                type="button"
                onClick={() => handleBrowsePath(field.game)}
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </div>
        );
      })}
      {status?.lastError && (
        <p className="m-0 text-error text-[0.8125rem]" role="alert">
          {status.lastError}
        </p>
      )}
    </section>
  );
}

export { GameLogSettingsCard };
