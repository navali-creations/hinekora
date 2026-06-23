import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/main/modules/editor";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  setZoom: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorTimelineZoomControls } from "./EditorTimelineZoomControls";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(
  input: {
    project?: EditorProject | null;
    selectedClipId?: string | null;
    zoom?: number;
  } = {},
) {
  const defaultProject = createEditorTestProject(createEditorTestAsset(), {
    durationSeconds: 30,
  });
  const project = "project" in input ? input.project : defaultProject;
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      project,
      selectedClipId:
        "selectedClipId" in input
          ? input.selectedClipId
          : defaultProject.activeClipId,
      setZoom: storeMocks.setZoom,
      zoom: input.zoom ?? 1,
    }),
  );
}

async function renderZoomControls() {
  await act(async () => {
    root.render(<EditorTimelineZoomControls />);
  });
}

describe("EditorTimelineZoomControls", () => {
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

  it("shows tooltips and changes zoom by one step", async () => {
    await renderZoomControls();

    const zoomOut = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Zoom out timeline"]',
    );
    const zoomIn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Zoom in timeline"]',
    );

    expect(zoomOut?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Zoom out timeline",
    );
    expect(zoomIn?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Zoom in timeline",
    );

    await act(async () => {
      zoomOut?.click();
      zoomIn?.click();
    });

    expect(storeMocks.setZoom).toHaveBeenNthCalledWith(1, 0.75);
    expect(storeMocks.setZoom).toHaveBeenNthCalledWith(2, 1.25);
  });

  it("disables zoom controls without a selected clip", async () => {
    configureEditorState({ selectedClipId: null });
    await renderZoomControls();

    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons[0]?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Select a timeline clip before zooming",
    );
  });

  it("disables zoom controls at the zoom bounds", async () => {
    configureEditorState({ zoom: 0.5 });
    await renderZoomControls();

    const zoomOut = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Zoom out timeline"]',
    );
    const zoomIn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Zoom in timeline"]',
    );

    expect(zoomOut?.disabled).toBe(true);
    expect(zoomOut?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Cannot zoom out further",
    );
    expect(zoomIn?.disabled).toBe(false);

    configureEditorState({ zoom: 4 });
    await renderZoomControls();

    expect(zoomIn?.disabled).toBe(true);
    expect(zoomIn?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Cannot zoom in further",
    );
  });

  it("keeps zoom in available when the content scale can still change", async () => {
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    configureEditorState({
      project,
      selectedClipId: project.activeClipId,
      zoom: 1,
    });

    await renderZoomControls();

    const zoomOut = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Zoom out timeline"]',
    );
    const zoomIn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Zoom in timeline"]',
    );

    expect(zoomOut?.disabled).toBe(false);
    expect(zoomIn?.disabled).toBe(false);
    expect(zoomIn?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Zoom in timeline",
    );
  });
});
