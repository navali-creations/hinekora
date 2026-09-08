import { useEffect } from "react";

function RendererReadyReporter() {
  useEffect(() => {
    void window.electron.mainWindow.rendererReady().catch(() => undefined);
  }, []);

  return null;
}

export { RendererReadyReporter };
