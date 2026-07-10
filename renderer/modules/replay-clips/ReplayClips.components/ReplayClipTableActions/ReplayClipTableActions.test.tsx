import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReplayClipView } from "~/main/test/factories/replayClip";

const storeMocks = vi.hoisted(() => ({
  deleteClip: vi.fn(),
  openClip: vi.fn(),
  revealClip: vi.fn(),
  useReplayClipsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useReplayClipsShallow: storeMocks.useReplayClipsShallow,
}));

import { ReplayClipTableActions } from "./ReplayClipTableActions";

let container: HTMLDivElement;
let root: Root;

function configureReplayClipsStore() {
  storeMocks.useReplayClipsShallow.mockImplementation((selector) =>
    selector({
      deleteClip: storeMocks.deleteClip,
      openClip: storeMocks.openClip,
      revealClip: storeMocks.revealClip,
    }),
  );
}

function getButton(label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) {
    throw new Error(`Could not find ${label} button`);
  }

  return button;
}

async function renderActions(clip = createReplayClipView()) {
  await act(async () => {
    root.render(<ReplayClipTableActions clip={clip} />);
  });
}

describe("ReplayClipTableActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureReplayClipsStore();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("opens playable clips from the open action", async () => {
    await renderActions(
      createReplayClipView({
        id: "clip-1",
        fileName: "clip-1.mp4",
        hasMediaFile: true,
        sizeBytes: 1024,
      }),
    );

    const openButton = getButton("Open clip");

    expect(openButton.disabled).toBe(false);

    await act(async () => {
      openButton.click();
    });

    expect(storeMocks.openClip).toHaveBeenCalledWith("clip-1");
  });

  it("shows an unavailable indicator for missing clips while leaving delete available", async () => {
    await renderActions(createReplayClipView({ id: "missing-clip" }));

    const indicator = container.querySelector(
      '[aria-label="Clip video unavailable"]',
    );
    const tooltip = indicator?.closest("[data-tip]");

    expect(container.querySelector('[aria-label="Open clip"]')).toBe(null);
    expect(indicator).not.toBe(null);
    expect(tooltip?.classList.contains("tooltip-left")).toBe(true);
    expect(tooltip?.getAttribute("data-row-click-ignore")).toBe("true");
    expect(tooltip?.getAttribute("data-tip")).toBe(
      "Video file is no longer available. Delete this clip to remove this missing entry.",
    );

    await act(async () => {
      getButton("Delete clip").click();
    });

    expect(storeMocks.openClip).not.toHaveBeenCalled();
    expect(storeMocks.deleteClip).toHaveBeenCalledWith("missing-clip");
  });
});
