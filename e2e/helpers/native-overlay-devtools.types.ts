interface NativeOverlayDevToolsState {
  overlays: Array<{
    devToolsOpened: boolean;
    focused: boolean;
  }>;
}

interface NativeOverlayDevToolsHarness {
  createOverlay: () => Promise<void>;
  getState: () => NativeOverlayDevToolsState;
}

type NativeOverlayDevToolsGlobal = typeof globalThis & {
  __HINEKORA_OVERLAY_DEVTOOLS_E2E__: NativeOverlayDevToolsHarness;
};

export type { NativeOverlayDevToolsGlobal, NativeOverlayDevToolsHarness };
