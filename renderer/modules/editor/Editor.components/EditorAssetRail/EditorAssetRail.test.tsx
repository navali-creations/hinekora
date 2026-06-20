import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";

const dndMocks = vi.hoisted(() => ({
  useDragOperation: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  refreshMedia: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("@dnd-kit/react", () => ({
  useDragOperation: dndMocks.useDragOperation,
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock("../EditorAssetCard/EditorAssetCard", () => ({
  EditorAssetCard: ({ asset }: { asset: { name: string } }) => (
    <div data-asset-card="true">{asset.name}</div>
  ),
}));

import { EditorAssetRail } from "./EditorAssetRail";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  const deathClip = createEditorTestAsset({
    assetKey: "clip:death",
    category: "death-clip",
    id: "death",
    name: "death.mp4",
  });
  const recording = createEditorTestAsset({
    assetKey: "recording:run",
    category: "recording",
    id: "run",
    kind: "recording",
    name: "run.mp4",
  });

  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      refreshMedia: storeMocks.refreshMedia,
      selectedAssetKey: null,
      workspace: {
        assets: [deathClip, recording],
        hasMoreProjects: false,
        project: createEditorTestProject(deathClip),
        projects: [],
      },
      ...overrides,
    }),
  );
}

function assetCardText(): string {
  return Array.from(container.querySelectorAll("[data-asset-card]"))
    .map((item) => item.textContent ?? "")
    .join(" ");
}

async function renderAssetRail() {
  await act(async () => {
    root.render(<EditorAssetRail />);
  });
}

describe("EditorAssetRail", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dndMocks.useDragOperation.mockReturnValue({ source: null });
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("refreshes media and filters the visible media type", async () => {
    await renderAssetRail();
    const refreshButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh media"]',
    );
    const mediaSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Media type"]',
    );

    expect(assetCardText()).toContain("death.mp4");
    expect(assetCardText()).not.toContain("run.mp4");

    await act(async () => {
      refreshButton?.click();
      if (!mediaSelect) {
        throw new Error("Expected media selector to render");
      }
      mediaSelect.value = "recording";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(storeMocks.refreshMedia).toHaveBeenCalledTimes(1);
    expect(assetCardText()).toContain("run.mp4");
    expect(assetCardText()).not.toContain("death.mp4");
  });
});
