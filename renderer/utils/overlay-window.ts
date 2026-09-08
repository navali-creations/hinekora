import { WindowName } from "~/main/modules/main-window/MainWindow.types";

const overlayRouteClassNames: Readonly<
  Partial<Record<WindowName, string | null>>
> = {
  [WindowName.RecorderOverlay]: null,
  [WindowName.ReplayStatusOverlay]: "is-replay-status-overlay-route",
  [WindowName.ClipPreviewOverlay]: "is-clip-preview-route",
  [WindowName.CropSelectorOverlay]: "is-crop-selector-route",
  [WindowName.AuraOverlay]: "is-aura-overlay-route",
};

type OverlayWindowName = Exclude<WindowName, WindowName.Main>;

interface OverlayRendererRoute {
  name: OverlayWindowName;
  routeClassName: string | null;
}

function getOverlayRendererRoute(hash: string): OverlayRendererRoute | null {
  const routeName = hash.replace(/^#\/?/u, "").split("?", 1)[0];
  if (!routeName || !Object.hasOwn(overlayRouteClassNames, routeName)) {
    return null;
  }

  const name = routeName as OverlayWindowName;
  return {
    name,
    routeClassName: overlayRouteClassNames[name] ?? null,
  };
}

export { getOverlayRendererRoute };
