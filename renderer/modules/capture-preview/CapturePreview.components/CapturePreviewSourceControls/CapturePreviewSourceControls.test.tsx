import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapturePreviewSource, GameId } from "~/types";

const screenSource: CapturePreviewSource = {
  displayId: "display:1",
  game: null,
  height: 1080,
  id: "screen:1",
  kind: "screen",
  name: "Screen 1",
  thumbnailDataUrl: null,
  width: 1920,
};
const poe1Source: CapturePreviewSource = {
  displayId: null,
  game: "poe1",
  height: null,
  id: "window:poe1",
  kind: "window",
  name: "Path of Exile 1",
  thumbnailDataUrl: null,
  width: null,
};
const poe2Source: CapturePreviewSource = {
  ...poe1Source,
  game: "poe2",
  id: "window:poe2",
  name: "Path of Exile 2",
};

const storeMocks = vi.hoisted(() => ({
  activeGame: "poe2" as GameId,
  isLoading: false,
  selectedSourceId: "window:poe2" as string | null,
  sources: [] as CapturePreviewSource[],
}));

vi.mock(
  "~/renderer/modules/capture-profiles/CaptureProfiles.components/CaptureProfileLockToggle/CaptureProfileLockToggle",
  () => ({
    CaptureProfileLockToggle: () => (
      <button type="button" aria-label="Unlock capture profile" />
    ),
  }),
);

vi.mock("~/renderer/store", () => ({
  useCapturePreviewShallow: (selector: (state: unknown) => unknown) =>
    selector({
      isLoading: storeMocks.isLoading,
      selectedSourceId: storeMocks.selectedSourceId,
      sources: storeMocks.sources,
    }),
  useSettingsSelector: (selector: (state: unknown) => unknown) =>
    selector({ value: { activeGame: storeMocks.activeGame } }),
}));

import { CapturePreviewSourceControls } from "./CapturePreviewSourceControls";

let container: HTMLDivElement;
let root: Root;

async function renderControls(): Promise<void> {
  await act(async () => {
    root.render(
      <CapturePreviewSourceControls
        isPreviewing={false}
        previewSourceId={null}
        onRefresh={vi.fn()}
        onSourceChange={vi.fn()}
        onTogglePreview={vi.fn()}
      />,
    );
  });
}

function getOption(value: string): HTMLOptionElement {
  const option = container.querySelector<HTMLOptionElement>(
    `option[value="${value}"]`,
  );

  if (!option) {
    throw new Error(`Missing source option: ${value}`);
  }

  return option;
}

describe("CapturePreviewSourceControls", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.activeGame = "poe2";
    storeMocks.isLoading = false;
    storeMocks.selectedSourceId = poe2Source.id;
    storeMocks.sources = [screenSource, poe1Source, poe2Source];
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("disables the opposite game source while keeping screens and active game sources available", async () => {
    await renderControls();

    expect(getOption(screenSource.id).disabled).toBe(false);
    expect(getOption(poe1Source.id).disabled).toBe(true);
    expect(getOption(poe2Source.id).disabled).toBe(false);
  });

  it("disables poe2 sources when poe1 is active", async () => {
    storeMocks.activeGame = "poe1";
    storeMocks.selectedSourceId = poe1Source.id;

    await renderControls();

    expect(getOption(poe1Source.id).disabled).toBe(false);
    expect(getOption(poe2Source.id).disabled).toBe(true);
  });
});
