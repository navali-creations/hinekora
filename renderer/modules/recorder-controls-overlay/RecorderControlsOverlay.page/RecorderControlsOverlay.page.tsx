import { useEffect, useState } from "react";

import type { RecorderOverlayMode } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { ExpandedRecorderControlsOverlay } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/ExpandedRecorderControlsOverlay/ExpandedRecorderControlsOverlay";
import { MinimizedRecorderControlsOverlay } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.components/MinimizedRecorderControlsOverlay/MinimizedRecorderControlsOverlay";

function RecorderControlsOverlayPage() {
  const [overlayMode, setOverlayMode] =
    useState<RecorderOverlayMode>("expanded");

  useEffect(() => {
    let mounted = true;
    void window.electron.overlayWindows.getRecorderMode().then((mode) => {
      if (mounted) {
        setOverlayMode(mode);
      }
    });
    const unsubscribe =
      window.electron.overlayWindows.onRecorderModeChanged(setOverlayMode);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setRecorderOverlayMode = (mode: RecorderOverlayMode) => {
    setOverlayMode(mode);
    void window.electron.overlayWindows
      .setRecorderMode(mode)
      .then(setOverlayMode);
  };
  const handleMinimizeOverlay = () => setRecorderOverlayMode("minimized");
  const handleExpandOverlay = () => setRecorderOverlayMode("expanded");

  return overlayMode === "minimized" ? (
    <MinimizedRecorderControlsOverlay onExpand={handleExpandOverlay} />
  ) : (
    <ExpandedRecorderControlsOverlay onMinimize={handleMinimizeOverlay} />
  );
}

export { RecorderControlsOverlayPage };
