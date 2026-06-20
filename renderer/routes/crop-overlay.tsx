import { createFileRoute } from "@tanstack/react-router";

import { CropOverlayPage } from "~/renderer/modules/crop-overlay/CropOverlay.page/CropOverlayPage/CropOverlayPage";

export const Route = createFileRoute("/crop-overlay")({
  component: CropOverlayPage,
});
