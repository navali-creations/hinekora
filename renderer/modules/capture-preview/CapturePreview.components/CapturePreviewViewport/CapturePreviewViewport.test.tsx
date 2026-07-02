import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapturePreviewSource } from "~/types";
import { CapturePreviewViewport } from "./CapturePreviewViewport";

const availableSource: CapturePreviewSource = {
  displayId: null,
  game: "poe1",
  height: null,
  id: "window:poe1",
  kind: "window",
  name: "Path of Exile 1",
  thumbnailDataUrl: null,
  width: null,
};
const unavailableSource: CapturePreviewSource = {
  ...availableSource,
  available: false,
  id: "missing-window:poe1",
  name: "Path of Exile 1 (not running)",
};

const storeMocks = vi.hoisted(() => ({
  selectedSourceId: null as string | null,
  sources: [] as CapturePreviewSource[],
  thumbnailsBySourceId: {} as Record<string, string | null | undefined>,
}));

vi.mock("~/renderer/store", () => ({
  useCapturePreviewShallow: (selector: (state: unknown) => unknown) =>
    selector({
      selectedSourceId: storeMocks.selectedSourceId,
      sources: storeMocks.sources,
      thumbnailsBySourceId: storeMocks.thumbnailsBySourceId,
    }),
}));

let container: HTMLDivElement;
let root: Root;

async function renderViewport(): Promise<void> {
  await act(async () => {
    root.render(
      <CapturePreviewViewport
        isPreviewing={false}
        videoRef={createRef<HTMLVideoElement>()}
      />,
    );
  });
}

describe("CapturePreviewViewport", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.selectedSourceId = null;
    storeMocks.sources = [];
    storeMocks.thumbnailsBySourceId = {};
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("shows unavailable copy for selected not-running game windows", async () => {
    storeMocks.sources = [unavailableSource];
    storeMocks.selectedSourceId = unavailableSource.id;

    await renderViewport();

    expect(container.textContent).toContain("Source unavailable");
  });

  it("shows stopped copy for available selected sources", async () => {
    storeMocks.sources = [availableSource];
    storeMocks.selectedSourceId = availableSource.id;

    await renderViewport();

    expect(container.textContent).toContain("Preview stopped");
  });
});
