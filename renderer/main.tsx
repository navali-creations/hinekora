import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { initUmami, trackPageView } from "./modules/umami";
import { routeTree } from "./routeTree.gen";
import { initSentry } from "./sentry";
import "./styles.css";

async function initTelemetry(): Promise<void> {
  if (!window.electron.settings?.get) {
    return;
  }

  try {
    const settings = await window.electron.settings.get();
    initSentry(settings.telemetryCrashReporting);
    initUmami(settings.telemetryUsageAnalytics);
  } catch (error) {
    console.warn(
      "[Renderer] Could not load telemetry settings, skipping telemetry init:",
      error,
    );
  }
}

void initTelemetry();

document.documentElement.dataset.theme = "hinekora";
document.body.dataset.theme = "hinekora";

const overlayRouteNames = [
  "recorder-overlay",
  "clip-preview-overlay",
  "crop-selector-overlay",
  "aura-overlay",
];
const isOverlayRoute = overlayRouteNames.some((routeName) =>
  window.location.hash.includes(routeName),
);
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

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOverlayRoute ? <App /> : <RouterProvider router={router} />}
  </React.StrictMode>,
);
