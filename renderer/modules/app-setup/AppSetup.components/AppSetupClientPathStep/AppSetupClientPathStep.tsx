import { useAppSetup } from "~/renderer/store";

import AppSetupClientPathSelector from "../AppSetupClientPathSelector/AppSetupClientPathSelector";

function AppSetupClientPathStep() {
  const { setupState, selectClientPath } = useAppSetup();
  const selectedGames = setupState?.selectedGames ?? [];
  const hasPoe1 = selectedGames.includes("poe1");
  const hasPoe2 = selectedGames.includes("poe2");
  const hasBoth = hasPoe1 && hasPoe2;

  const handlePoe1FileSelect = async () => {
    const filePath = await window.electron.app.selectPath({
      title: "Select Path of Exile 1 Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await selectClientPath("poe1", filePath);
    }
  };

  const handlePoe2FileSelect = async () => {
    const filePath = await window.electron.app.selectPath({
      title: "Select Path of Exile 2 Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await selectClientPath("poe2", filePath);
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-base-content">
        Select Client.txt location
      </h2>
      <p className="mb-3 text-sm text-base-content/60">
        Hinekora uses this file to detect deaths and game focus changes, so
        overlays can appear only while Path of Exile is active.
      </p>

      <div className="mb-3 space-y-1 rounded-lg border border-base-content/10 bg-base-100 p-2 text-xs">
        <p className="font-medium text-base-content/70">Typical locations:</p>
        <p>
          <span className="text-base-content/40">Steam:</span>{" "}
          <code className="rounded bg-base-300 px-1 py-0.5 text-base-content/60">
            C:\Program Files (x86)\Steam\steamapps\common\Path of Exile
            {hasBoth && <span className="font-medium text-primary"> (2)</span>}
            {!hasBoth && hasPoe2 && " 2"}\logs\Client.txt
          </code>
        </p>
        <p>
          <span className="text-base-content/40">Standalone:</span>{" "}
          <code className="rounded bg-base-300 px-1 py-0.5 text-base-content/60">
            C:\Program Files (x86)\Grinding Gear Games\Path of Exile
            {hasBoth && <span className="font-medium text-primary"> (2)</span>}
            {!hasBoth && hasPoe2 && " 2"}\logs\Client.txt
          </code>
        </p>
        {hasBoth && (
          <p className="mt-1 italic text-base-content/40">
            (2) = Path of Exile 2 folder
          </p>
        )}
      </div>

      {hasPoe1 && (
        <AppSetupClientPathSelector
          currentPath={setupState?.poe1ClientPath ?? ""}
          label="Path of Exile 1 Client.txt"
          onSelectPath={handlePoe1FileSelect}
        />
      )}

      {hasPoe2 && (
        <AppSetupClientPathSelector
          currentPath={setupState?.poe2ClientPath ?? ""}
          label="Path of Exile 2 Client.txt"
          onSelectPath={handlePoe2FileSelect}
        />
      )}
    </div>
  );
}

export default AppSetupClientPathStep;
