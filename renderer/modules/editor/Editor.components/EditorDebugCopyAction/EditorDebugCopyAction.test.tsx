import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  useBoundStore: {
    getState: vi.fn(),
  },
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: storeMocks.useBoundStore,
}));

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";
import { EditorDebugCopyAction } from "./EditorDebugCopyAction";

let container: HTMLDivElement;
let root: Root;
const writeText = vi.fn();

function configureEditorState() {
  const asset = createEditorTestAsset();
  const project = createEditorTestProject(asset);
  storeMocks.useBoundStore.getState.mockReturnValue({
    editor: {
      historyFuture: [],
      historyFutureLabels: [],
      historyFutureSubtitles: [],
      historyPast: [],
      historyPastLabels: ["Split"],
      historyPastSubtitles: [null],
      mediaAssetPage: {
        items: [asset],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 5,
        totalCount: 1,
      },
      mediaAssetPendingQuery: null,
      mediaAssetQuery: {
        category: "death-clip",
        game: "poe2",
        pageIndex: 0,
        pageSize: 5,
      },
      mediaFilter: "death-clip",
      mediaPageIndex: 0,
      mediaRailTab: "all",
      playbackSeconds: 1.5,
      previewHasAudio: true,
      project,
      savedEditPageIndex: 0,
      selectedAssetKey: asset.assetKey,
      selectedClipId: "timeline-1",
      workspace: {
        assets: [asset],
        hasMoreProjects: false,
        project,
        projects: [],
      },
      zoom: 2,
    },
  });
}

async function renderDebugCopyAction() {
  await act(async () => {
    root.render(<EditorDebugCopyAction />);
  });
}

describe("EditorDebugCopyAction", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("copies an editor project and workspace debug snapshot", async () => {
    await renderDebugCopyAction();
    const button = container.querySelector<HTMLButtonElement>("button");

    await act(async () => {
      button?.click();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(writeText.mock.calls[0]?.[0] ?? "{}") as {
      editor?: {
        historyPastLabels?: string[];
        historyPastSubtitles?: Array<string | null>;
        mediaFilter?: string;
        playbackSeconds?: number;
        project?: { id: string };
        workspace?: { project: { id: string } };
      };
    };
    expect(payload.editor).toMatchObject({
      historyPastLabels: ["Split"],
      historyPastSubtitles: [null],
      mediaFilter: "death-clip",
      playbackSeconds: 1.5,
      project: { id: "project-1" },
      workspace: { project: { id: "project-1" } },
    });
    expect(container.textContent).toContain("Debug");
    expect(storeMocks.useBoundStore.getState).toHaveBeenCalledTimes(1);
  });
});
