import type { ChangeEvent } from "react";
import { FiFolder as FolderOpen, FiSave as Save } from "react-icons/fi";

import { StatusPill } from "~/renderer/components/StatusPill/StatusPill";
import { useClientLogShallow } from "~/renderer/store";

function ClientLogPanel() {
  const { pendingPath, savePath, setPendingPath, status } = useClientLogShallow(
    (clientLog) => ({
      pendingPath: clientLog.pendingPath,
      savePath: clientLog.savePath,
      setPendingPath: clientLog.setPendingPath,
      status: clientLog.status,
    }),
  );

  const handlePathChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPendingPath(event.target.value);
  };
  const handleSavePath = () => void savePath();
  const handleBrowsePath = async () => {
    const filePath = await window.electron.app.selectPath({
      title: "Select Path of Exile Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await savePath(filePath);
    }
  };

  return (
    <section className="grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">Client.txt</h2>
        <StatusPill
          label={status?.watching ? "Watching" : "Idle"}
          tone={status?.watching ? "good" : "neutral"}
        />
      </div>
      <label className="grid gap-1.5 text-primary text-[0.8125rem]">
        Log path
        <input
          className="input input-bordered w-full"
          value={pendingPath}
          onChange={handlePathChange}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleBrowsePath}
        >
          <FolderOpen size={16} />
          Browse
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleSavePath}
        >
          <Save size={16} />
          Save path
        </button>
      </div>
      {status?.lastError && (
        <p className="m-0 text-error text-[0.8125rem]">{status.lastError}</p>
      )}
    </section>
  );
}

export { ClientLogPanel };
