import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  setPreviewVolume: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorAudioControls } from "./EditorAudioControls";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      previewHasAudio: true,
      previewVolume: 0.5,
      setPreviewVolume: storeMocks.setPreviewVolume,
      ...overrides,
    }),
  );
}

async function renderAudioControls() {
  await act(async () => {
    root.render(<EditorAudioControls />);
  });
}

describe("EditorAudioControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("shows the active preview volume", async () => {
    await renderAudioControls();

    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Editor preview volume"]',
      )?.value,
    ).toBe("0.5");
    expect(container.firstElementChild?.getAttribute("data-tip")).toBe(
      "Preview volume 50%",
    );
  });

  it("hides the slider when the preview has no audio", async () => {
    configureEditorState({ previewHasAudio: false });

    await renderAudioControls();

    expect(
      container.querySelector('[aria-label="Editor preview volume"]'),
    ).toBe(null);
  });
});
