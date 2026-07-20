import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  fitTimelineToEdit: vi.fn(),
  redoProjectChange: vi.fn(),
  removeAllTimelineGaps: vi.fn(),
  removeTimelineClip: vi.fn(),
  setSelectedTimelineClipPlaybackRate: vi.fn(),
  setZoom: vi.fn(),
  setTimelineGapsHighlighted: vi.fn(),
  splitTimelineClipAt: vi.fn(),
  toggleProjectAudioMuted: vi.fn(),
  undoProjectChange: vi.fn(),
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: storeMocks.useBoundStore,
}));

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";
import { EditorTimelineTools } from "./EditorTimelineTools";

let container: HTMLDivElement;
let root: Root;
let editorState: Record<string, unknown>;

function configureEditorState(overrides: Record<string, unknown> = {}) {
  editorState = {
    clipboardState: { error: null, requestId: null, status: "idle" },
    exportState: { status: "idle" },
    fitTimelineToEdit: storeMocks.fitTimelineToEdit,
    historyFuture: [],
    historyPast: [],
    playbackSeconds: 2,
    previewHasAudio: true,
    isTimelineFitToEdit: false,
    project: createEditorTestProject(),
    redoProjectChange: storeMocks.redoProjectChange,
    removeAllTimelineGaps: storeMocks.removeAllTimelineGaps,
    removeTimelineClip: storeMocks.removeTimelineClip,
    selectedClipId: "timeline-1",
    setSelectedTimelineClipPlaybackRate:
      storeMocks.setSelectedTimelineClipPlaybackRate,
    setZoom: storeMocks.setZoom,
    setTimelineGapsHighlighted: storeMocks.setTimelineGapsHighlighted,
    splitTimelineClipAt: storeMocks.splitTimelineClipAt,
    toggleProjectAudioMuted: storeMocks.toggleProjectAudioMuted,
    undoProjectChange: storeMocks.undoProjectChange,
    ...overrides,
  };
  storeMocks.useBoundStore.mockImplementation((selector) =>
    selector({ editor: editorState }),
  );
  (
    storeMocks.useBoundStore as unknown as {
      getState: () => { editor: Record<string, unknown> };
    }
  ).getState = vi.fn(() => ({ editor: editorState }));
}

async function renderTimelineTools() {
  await act(async () => {
    root.render(<EditorTimelineTools />);
  });
}

describe("EditorTimelineTools", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("splits, changes speed, mutes, and deletes the selected timeline clip", async () => {
    await renderTimelineTools();
    const splitButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Split"]',
    );
    const speedButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clip speed: 1x"]',
    );
    expect(speedButton?.querySelector("svg")).not.toBe(null);
    if (speedButton) {
      speedButton.getBoundingClientRect = vi.fn(() => ({
        bottom: 224,
        height: 24,
        left: 100,
        right: 124,
        top: 200,
        width: 24,
        x: 100,
        y: 200,
        toJSON: vi.fn(),
      }));
    }

    await act(async () => {
      speedButton?.click();
    });

    const speedMenu = document.querySelector<HTMLUListElement>(
      '[aria-label="Clip speed options"]',
    );
    const defaultSpeedOption = document.querySelector<HTMLButtonElement>(
      '[data-playback-rate="1"]',
    );
    const fastestSpeedOption = document.querySelector<HTMLButtonElement>(
      '[data-playback-rate="16"]',
    );
    const muteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Mute audio"]',
    );
    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Delete selected clip"]',
    );
    expect(speedMenu).not.toBe(null);
    expect(defaultSpeedOption?.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      splitButton?.click();
      fastestSpeedOption?.click();
      muteButton?.click();
      deleteButton?.click();
    });

    expect(storeMocks.splitTimelineClipAt).toHaveBeenCalledWith(2);
    expect(storeMocks.setSelectedTimelineClipPlaybackRate).toHaveBeenCalledWith(
      16,
    );
    expect(storeMocks.toggleProjectAudioMuted).toHaveBeenCalledTimes(1);
    expect(storeMocks.removeTimelineClip).toHaveBeenCalledWith("timeline-1");
  });

  it("moves focus through speed options and restores the trigger on Escape", async () => {
    await renderTimelineTools();
    const speedButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clip speed: 1x"]',
    );
    if (!speedButton) {
      throw new Error("Expected clip speed button");
    }
    speedButton.getBoundingClientRect = vi.fn(() => ({
      bottom: 224,
      height: 24,
      left: 100,
      right: 124,
      top: 200,
      width: 24,
      x: 100,
      y: 200,
      toJSON: vi.fn(),
    }));

    await act(async () => {
      speedButton.focus();
      speedButton.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      );
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const speedMenu = document.querySelector<HTMLUListElement>(
      '[aria-label="Clip speed options"]',
    );
    const firstSpeedOption = document.querySelector<HTMLButtonElement>(
      '[data-playback-rate="0.25"]',
    );
    expect(document.activeElement).toBe(firstSpeedOption);

    await act(async () => {
      speedMenu?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      );
    });
    expect(document.activeElement).toBe(
      document.querySelector('[data-playback-rate="0.5"]'),
    );

    await act(async () => {
      speedMenu?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "End" }),
      );
    });
    expect(document.activeElement).toBe(
      document.querySelector('[data-playback-rate="16"]'),
    );

    await act(async () => {
      speedMenu?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    expect(document.querySelector('[aria-label="Clip speed options"]')).toBe(
      null,
    );
    expect(document.activeElement).toBe(speedButton);
  });

  it("disables speeds that would exceed the export duration limit", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 22_000 });
    const project = createEditorTestProject(asset);
    const clip = createEditorTestTimelineClip(asset, {
      durationSeconds: 22_000,
      outSeconds: 22_000,
      sourceOutSeconds: 22_000,
    });
    configureEditorState({
      project: {
        ...project,
        activeClipId: clip.id,
        durationSeconds: 22_000,
        tracks: [{ ...project.tracks[0]!, clips: [clip] }],
      },
      selectedClipId: clip.id,
    });
    await renderTimelineTools();
    const speedButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clip speed: 1x"]',
    );
    if (!speedButton) {
      throw new Error("Expected clip speed button");
    }
    speedButton.getBoundingClientRect = vi.fn(() => ({
      bottom: 224,
      height: 24,
      left: 100,
      right: 124,
      top: 200,
      width: 24,
      x: 100,
      y: 200,
      toJSON: vi.fn(),
    }));

    await act(async () => {
      speedButton.click();
    });

    expect(
      document.querySelector<HTMLButtonElement>('[data-playback-rate="0.25"]')
        ?.disabled,
    ).toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>('[data-playback-rate="1"]')
        ?.disabled,
    ).toBe(false);
  });

  it("undoes and redoes project edits from the toolbar", async () => {
    configureEditorState({
      historyFuture: [createEditorTestProject()],
      historyPast: [createEditorTestProject()],
    });
    await renderTimelineTools();
    const undoButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Undo"]',
    );
    const redoButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Redo"]',
    );

    await act(async () => {
      undoButton?.click();
      redoButton?.click();
    });

    expect(storeMocks.undoProjectChange).toHaveBeenCalledTimes(1);
    expect(storeMocks.redoProjectChange).toHaveBeenCalledTimes(1);
  });

  it("fits the spacious timeline back to the edit duration", async () => {
    await renderTimelineTools();
    const fitButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Fit timeline"]',
    );

    await act(async () => {
      fitButton?.click();
    });

    expect(fitButton?.disabled).toBe(false);
    expect(storeMocks.fitTimelineToEdit).toHaveBeenCalledTimes(1);
  });

  it("marks the fit timeline tool while exact fit is active", async () => {
    configureEditorState({ isTimelineFitToEdit: true });
    await renderTimelineTools();
    const fitButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Fit timeline"]',
    );

    await act(async () => {
      fitButton?.click();
    });

    expect(fitButton?.className.includes("btn-primary")).toBe(true);
    expect(fitButton?.disabled).toBe(true);
    expect(storeMocks.fitTimelineToEdit).not.toHaveBeenCalled();
  });

  it("disables timeline tools while the editor is processing", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
      historyFuture: [createEditorTestProject()],
      historyPast: [createEditorTestProject()],
    });
    await renderTimelineTools();
    const splitButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Split"]',
    );
    const muteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Mute audio"]',
    );
    const speedButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clip speed: 1x"]',
    );
    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Delete selected clip"]',
    );
    const fitButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Fit timeline"]',
    );
    const undoButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Undo"]',
    );
    const redoButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Redo"]',
    );

    await act(async () => {
      undoButton?.click();
      redoButton?.click();
      splitButton?.click();
      muteButton?.click();
      speedButton?.click();
      fitButton?.click();
      deleteButton?.click();
    });

    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);
    expect(splitButton?.disabled).toBe(true);
    expect(speedButton?.disabled).toBe(true);
    expect(container.querySelector('[aria-label="Clip speed options"]')).toBe(
      null,
    );
    expect(muteButton?.disabled).toBe(true);
    expect(deleteButton?.disabled).toBe(true);
    expect(fitButton?.disabled).toBe(true);
    expect(storeMocks.undoProjectChange).not.toHaveBeenCalled();
    expect(storeMocks.redoProjectChange).not.toHaveBeenCalled();
    expect(storeMocks.splitTimelineClipAt).not.toHaveBeenCalled();
    expect(
      storeMocks.setSelectedTimelineClipPlaybackRate,
    ).not.toHaveBeenCalled();
    expect(storeMocks.toggleProjectAudioMuted).not.toHaveBeenCalled();
    expect(storeMocks.fitTimelineToEdit).not.toHaveBeenCalled();
    expect(storeMocks.setZoom).not.toHaveBeenCalled();
    expect(storeMocks.removeTimelineClip).not.toHaveBeenCalled();
  });

  it("closes an open speed menu when editor processing starts", async () => {
    await renderTimelineTools();
    const speedButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clip speed: 1x"]',
    );
    if (!speedButton) {
      throw new Error("Expected clip speed button");
    }
    speedButton.getBoundingClientRect = vi.fn(() => ({
      bottom: 224,
      height: 24,
      left: 100,
      right: 124,
      top: 200,
      width: 24,
      x: 100,
      y: 200,
      toJSON: vi.fn(),
    }));

    await act(async () => {
      speedButton.click();
    });
    expect(
      document.querySelector('[aria-label="Clip speed options"]'),
    ).not.toBe(null);

    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderTimelineTools();

    expect(document.querySelector('[aria-label="Clip speed options"]')).toBe(
      null,
    );
  });

  it("highlights and removes all timeline gaps", async () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 8,
    });
    configureEditorState({
      project: {
        ...project,
        durationSeconds: 13,
        tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
      },
    });
    await renderTimelineTools();
    const clearGapsButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clear gaps"]',
    );

    await act(async () => {
      clearGapsButton?.focus();
      clearGapsButton?.click();
      clearGapsButton?.blur();
    });

    expect(storeMocks.setTimelineGapsHighlighted).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(storeMocks.removeAllTimelineGaps).toHaveBeenCalledTimes(1);
    expect(storeMocks.setTimelineGapsHighlighted).toHaveBeenLastCalledWith(
      false,
    );
  });

  it("shows the muted state and disables gap removal when no gaps exist", async () => {
    configureEditorState({
      project: { ...createEditorTestProject(), isAudioMuted: true },
    });
    await renderTimelineTools();

    expect(
      container
        .querySelector<HTMLButtonElement>('[aria-label="Unmute audio"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="Clear gaps"]')
        ?.disabled,
    ).toBe(true);
  });

  it("hides the mute tool when the selected preview has no audio", async () => {
    configureEditorState({ previewHasAudio: false });
    await renderTimelineTools();

    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="Mute audio"]'),
    ).toBe(null);
  });
});
