import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEditorTestAsset } from "../../Editor.slice/Editor.slice.test-utils";

const dndMocks = vi.hoisted(() => ({
  useDraggable: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  selectAsset: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("@dnd-kit/react", () => ({
  useDraggable: dndMocks.useDraggable,
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorAssetCard } from "./EditorAssetCard";

let container: HTMLDivElement;
let root: Root;

async function renderAssetCard(
  asset = createEditorTestAsset(),
): Promise<HTMLButtonElement> {
  await act(async () => {
    root.render(<EditorAssetCard asset={asset} />);
  });

  const button = container.querySelector<HTMLButtonElement>("button");
  if (!button) {
    throw new Error("Expected asset card button to render");
  }

  return button;
}

describe("EditorAssetCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dndMocks.useDraggable.mockReturnValue({
      isDragging: false,
      ref: vi.fn(),
    });
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        selectAsset: storeMocks.selectAsset,
        selectedAssetKey: null,
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("selects and enables dragging for ready media", async () => {
    const asset = createEditorTestAsset();
    const button = await renderAssetCard(asset);

    expect(button.disabled).toBe(false);
    expect(dndMocks.useDraggable).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: false,
        id: `asset:${asset.assetKey}`,
      }),
    );

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(storeMocks.selectAsset).toHaveBeenCalledWith(asset.assetKey);
  });

  it("disables unavailable media and prevents selection", async () => {
    const asset = createEditorTestAsset({
      exists: false,
      mediaUrl: null,
      status: "missing",
    });
    const button = await renderAssetCard(asset);

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Missing");
    expect(dndMocks.useDraggable).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
        id: `asset:${asset.assetKey}`,
      }),
    );

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(storeMocks.selectAsset).not.toHaveBeenCalled();
  });
});
