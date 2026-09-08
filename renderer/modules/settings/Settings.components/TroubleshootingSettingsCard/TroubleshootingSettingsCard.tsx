import { type ChangeEvent, useCallback, useState } from "react";
import { FiFileText } from "react-icons/fi";

import { useSettingsShallow } from "~/renderer/store";

import { SettingsToggleRow } from "../SettingsToggleRow/SettingsToggleRow";

type DiagnosticLogStatus = "idle" | "opening" | "error";

function TroubleshootingSettingsCard() {
  const [diagnosticLogStatus, setDiagnosticLogStatus] =
    useState<DiagnosticLogStatus>("idle");
  const isOpeningDiagnosticLog = diagnosticLogStatus === "opening";
  const {
    editorLogError,
    isEditorLogEnabled,
    isOverlayDevToolsEnabled,
    overlayDevToolsError,
    updatePreference,
  } = useSettingsShallow((settings) => ({
    editorLogError: settings.preferenceErrors.editorLogEnabled ?? null,
    isEditorLogEnabled: settings.value?.editorLogEnabled ?? false,
    isOverlayDevToolsEnabled: settings.value?.overlayDevToolsEnabled ?? false,
    overlayDevToolsError:
      settings.preferenceErrors.overlayDevToolsEnabled ?? null,
    updatePreference: settings.updatePreference,
  }));

  const handleOpenDiagnosticLog = useCallback(async () => {
    setDiagnosticLogStatus("opening");

    try {
      const result = await window.electron.diagLog.revealLogFile();
      setDiagnosticLogStatus(result.success ? "idle" : "error");
    } catch {
      setDiagnosticLogStatus("error");
    }
  }, []);

  const handleEditorLogChange = (event: ChangeEvent<HTMLInputElement>) => {
    void updatePreference("editorLogEnabled", event.target.checked);
  };

  const handleOverlayDevToolsChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    void updatePreference("overlayDevToolsEnabled", event.target.checked);
  };

  return (
    <section className="col-span-12 space-y-3">
      <p className="sr-only">Troubleshooting settings</p>

      <div className="divide-y divide-base-content/10">
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0 [text-wrap:wrap]">
            <h2 className="m-0 font-bold text-base-content text-sm">
              Diagnostic Log
            </h2>
            <p className="mt-1 mb-0 text-base-content/60 text-sm">
              View startup, recording, and crash diagnostics. The log is cleared
              on each app launch.
            </p>
            {diagnosticLogStatus === "error" ? (
              <p className="mt-2 mb-0 text-error text-xs" role="status">
                Could not open diagnostic log.
              </p>
            ) : null}
          </div>
          <button
            className="btn btn-primary btn-sm shrink-0 gap-2"
            disabled={isOpeningDiagnosticLog}
            type="button"
            onClick={handleOpenDiagnosticLog}
          >
            <FiFileText size={15} />
            {isOpeningDiagnosticLog ? "Opening..." : "Open log file"}
          </button>
        </div>

        <SettingsToggleRow
          ariaLabel="Editor log"
          checked={isEditorLogEnabled}
          description="Show the editor Debug action for copying workspace state when diagnosing editor issues."
          label="Editor log"
          statusClassName="text-error"
          statusLabel={editorLogError}
          statusRole="alert"
          onChange={handleEditorLogChange}
        />

        <SettingsToggleRow
          ariaLabel="Overlay Developer Tools"
          checked={isOverlayDevToolsEnabled}
          description="Open a separate Developer Tools window for every overlay, including overlays opened while this setting is enabled."
          label="Overlay Developer Tools"
          statusClassName="text-error"
          statusLabel={overlayDevToolsError}
          statusRole="alert"
          onChange={handleOverlayDevToolsChange}
        />
      </div>
    </section>
  );
}

export { TroubleshootingSettingsCard };
