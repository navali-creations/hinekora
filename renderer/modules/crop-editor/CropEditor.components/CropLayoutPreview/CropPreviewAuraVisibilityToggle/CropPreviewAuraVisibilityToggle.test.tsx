import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  setShowAllAurasInPreview: vi.fn(),
  showAllAurasInPreview: false,
  useCropEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCropEditorShallow: storeMocks.useCropEditorShallow,
}));

import { CropPreviewAuraVisibilityToggle } from "./CropPreviewAuraVisibilityToggle";

let container: HTMLDivElement;
let root: Root;

async function renderToggle(): Promise<void> {
  await act(async () => {
    root.render(<CropPreviewAuraVisibilityToggle />);
  });
}

function getCheckbox(): HTMLInputElement {
  const checkbox = container.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!checkbox) {
    throw new Error("Expected the show all auras checkbox to render");
  }

  return checkbox;
}

describe("CropPreviewAuraVisibilityToggle", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.setShowAllAurasInPreview.mockReset();
    storeMocks.showAllAurasInPreview = false;
    storeMocks.useCropEditorShallow.mockImplementation((selector) =>
      selector({
        setShowAllAurasInPreview: storeMocks.setShowAllAurasInPreview,
        showAllAurasInPreview: storeMocks.showAllAurasInPreview,
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("renders the current preview visibility state", async () => {
    storeMocks.showAllAurasInPreview = true;

    await renderToggle();

    expect(container.textContent).toContain("Show all auras");
    expect(getCheckbox().checked).toBe(true);
  });

  it("updates preview visibility when toggled", async () => {
    await renderToggle();
    const checkbox = getCheckbox();

    await act(async () => {
      checkbox.click();
    });

    expect(storeMocks.setShowAllAurasInPreview).toHaveBeenCalledWith(true);
  });
});
