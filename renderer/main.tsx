import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { trackPageView } from "./modules/umami";
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import { initTelemetry } from "./telemetry";

void initTelemetry();

document.documentElement.dataset.theme = "hinekora";
document.body.dataset.theme = "hinekora";

const overlayRoutes = [
  { name: "recorder-overlay", routeClassName: null },
  { name: "clip-preview-overlay", routeClassName: "is-clip-preview-route" },
  { name: "crop-selector-overlay", routeClassName: "is-crop-selector-route" },
  { name: "aura-overlay", routeClassName: "is-aura-overlay-route" },
] as const;
const overlayRoute = overlayRoutes.find((route) =>
  window.location.hash.includes(route.name),
);
const isOverlayRoute = overlayRoute !== undefined;

if (overlayRoute?.routeClassName) {
  document.documentElement.classList.add(overlayRoute.routeClassName);
  document.body.classList.add(overlayRoute.routeClassName);
}
const hashHistory = createHashHistory();
const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 5_000,
});

router.subscribe("onResolved", ({ toLocation, pathChanged, fromLocation }) => {
  if (pathChanged || !fromLocation) {
    trackPageView(toLocation.pathname);
  }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const renderer = isOverlayRoute ? (
  <App />
) : (
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

createRoot(document.getElementById("root") as HTMLElement).render(renderer);
