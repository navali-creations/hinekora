import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEditorTestProject } from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  setPlaybackSeconds: vi.fn(),
  setPreviewPlaying: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorPlaybackControls } from "./EditorPlaybackControls";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      isPreviewPlaying: false,
      playbackSeconds: 4,
      project: createEditorTestProject(),
      selectedClipId: "timeline-1",
      setPlaybackSeconds: storeMocks.setPlaybackSeconds,
      setPreviewPlaying: storeMocks.setPreviewPlaying,
      ...overrides,
    }),
  );
}

async function renderPlaybackControls() {
  await act(async () => {
    root.render(<EditorPlaybackControls />);
  });
}

describe("EditorPlaybackControls", () => {
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

  it("disables transport actions when no clip is selected", async () => {
    configureEditorState({ selectedClipId: null });

    await renderPlaybackControls();

    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Play preview"]',
      )?.disabled,
    ).toBe(true);
  });

  it("updates playback state from transport controls", async () => {
    await renderPlaybackControls();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Jump to start"]')
        ?.click();
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Seek backward 5 seconds"]',
        )
        ?.click();
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Seek forward 5 seconds"]',
        )
        ?.click();
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Play preview"]')
        ?.click();
    });

    expect(storeMocks.setPlaybackSeconds).toHaveBeenNthCalledWith(1, 0);
    expect(storeMocks.setPreviewPlaying).toHaveBeenNthCalledWith(1, false);
    expect(storeMocks.setPlaybackSeconds).toHaveBeenNthCalledWith(2, -1);
    expect(storeMocks.setPlaybackSeconds).toHaveBeenNthCalledWith(3, 9);
    expect(storeMocks.setPreviewPlaying).toHaveBeenNthCalledWith(2, true);
  });

  it("pauses from the playing state", async () => {
    configureEditorState({ isPreviewPlaying: true });

    await renderPlaybackControls();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Pause preview"]')
        ?.click();
    });

    expect(storeMocks.setPreviewPlaying).toHaveBeenCalledWith(false);
  });
});
