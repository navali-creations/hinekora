import type { WebContents } from "electron";

import {
  createSafePathLogFields,
  logError,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { isExpectedRendererLoadInterruption } from "~/main/utils/renderer-navigation";

interface RendererFailureDiagnosticsOptions {
  logScope: string;
  windowKind: string;
}

function registerRendererFailureDiagnostics(
  webContents: Pick<WebContents, "on">,
  options: RendererFailureDiagnosticsOptions,
): void {
  webContents.on("preload-error", (_event, preloadPath, error) => {
    logError(options.logScope, `${options.windowKind} preload failed`, {
      ...createSafePathLogFields(preloadPath, "preload"),
      error: safeErrorMessage(error),
    });
  });
  webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (
        !isMainFrame ||
        isExpectedRendererLoadInterruption(errorCode, errorDescription)
      ) {
        return;
      }

      logWarn(
        options.logScope,
        `${options.windowKind} renderer failed to load`,
        {
          errorCode,
          error: safeErrorMessage(new Error(errorDescription)),
        },
      );
    },
  );
}

export { registerRendererFailureDiagnostics };
