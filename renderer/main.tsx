import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { RendererReadyReporter } from "./components/RendererReadyReporter/RendererReadyReporter";
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import { initTelemetry } from "./telemetry";
import { getOverlayRendererRoute } from "./utils/overlay-window";

void initTelemetry();

document.documentElement.dataset.theme = "hinekora";
document.body.dataset.theme = "hinekora";

const overlayRoute = getOverlayRendererRoute(window.location.hash);
const isOverlayRoute = overlayRoute !== null;

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

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const renderer = isOverlayRoute ? (
  <App />
) : (
  <React.StrictMode>
    <RendererReadyReporter />
    <RouterProvider router={router} />
  </React.StrictMode>
);

createRoot(document.getElementById("root") as HTMLElement).render(renderer);
