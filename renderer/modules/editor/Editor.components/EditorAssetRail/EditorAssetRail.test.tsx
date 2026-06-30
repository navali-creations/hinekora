import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";
import { editorMediaAssetDragType } from "../../Editor.utils/Editor.utils";

const dndMocks = vi.hoisted(() => ({
  useDragOperation: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  hydrateMediaAssets: vi.fn(),
  hydrateLibrary: vi.fn(),
  revealEditInExplorer: vi.fn(),
  refreshMediaRecentlyClippedSince: vi.fn(),
  resetMediaPagination: vi.fn(),
  setMediaFilter: vi.fn(),
  setMediaPageIndex: vi.fn(),
  setMediaRailTab: vi.fn(),
  setSavedEditPageIndex: vi.fn(),
  useEditorShallow: vi.fn(),
  useSavedEditsShallow: vi.fn(),
}));
const electronMocks = vi.hoisted(() => ({
  getRecording: vi.fn(),
  replayReveal: vi.fn(),
  revealRecording: vi.fn(),
}));

vi.mock("@dnd-kit/react", () => ({
  useDragOperation: dndMocks.useDragOperation,
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
  useSavedEditsShallow: storeMocks.useSavedEditsShallow,
}));

vi.mock("../EditorAssetCard/EditorAssetCard", () => ({
  EditorAssetCard: ({ asset }: { asset: { name: string } }) => (
    <div data-asset-card="true">{asset.name}</div>
  ),
}));
vi.mock("../EditorSavedEditCard/EditorSavedEditCard", () => ({
  EditorSavedEditCard: ({ edit }: { edit: { title: string } }) => (
    <div data-saved-edit-card="true">{edit.title}</div>
  ),
}));

import { EditorAssetRail } from "./EditorAssetRail";

let container: HTMLDivElement;
let root: Root;
let currentEditorState: Record<string, unknown>;
let currentSavedEditsState: Record<string, unknown>;

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
  const manualReplay = createEditorTestAsset({
    assetKey: "clip:manual",
    category: "manual-replay",
    id: "manual",
    name: "manual.mp4",
  });
  const olderDeathClips = Array.from({ length: 6 }, (_, index) =>
    createEditorTestAsset({
      assetKey: `clip:death-${index}`,
      category: "death-clip",
      id: `death-${index}`,
      name: `death-${index}.mp4`,
    }),
  );
  const mediaAssets = [deathClip, recording, manualReplay, ...olderDeathClips];

  function createMediaAssetPage(query: {
    category: string;
    createdAfter?: string;
    excludeAssetKeys?: string[];
    game: string;
    includeAssetKeys?: string[];
    league?: string;
    pageIndex?: number;
    pageSize?: number;
  }) {
    const pageSize = query.pageSize ?? 5;
    const pageIndex = query.pageIndex ?? 0;
    const offset = pageIndex * pageSize;
    const filteredAssets = mediaAssets.filter((asset) => {
      if (asset.category !== query.category) {
        return false;
      }
      if (query.includeAssetKeys) {
        return query.includeAssetKeys.includes(asset.assetKey);
      }
      if (asset.sourceGame !== query.game) {
        return false;
      }
      if (query.league && asset.sourceLeague !== query.league) {
        return false;
      }
      if (query.excludeAssetKeys?.includes(asset.assetKey)) {
        return false;
      }
      if (
        query.createdAfter &&
        Date.parse(asset.createdAt) < Date.parse(query.createdAfter)
      ) {
        return false;
      }

      return true;
    });

    return {
      items: filteredAssets.slice(offset, offset + pageSize),
      pageCount: Math.max(1, Math.ceil(filteredAssets.length / pageSize)),
      pageIndex,
      pageSize,
      totalCount: filteredAssets.length,
    };
  }

  storeMocks.hydrateMediaAssets.mockImplementation(
    async (query: {
      category: string;
      createdAfter?: string;
      excludeAssetKeys?: string[];
      game: string;
      includeAssetKeys?: string[];
      league?: string;
      pageIndex?: number;
      pageSize?: number;
    }) => {
      const page = createMediaAssetPage(query);
      currentEditorState = {
        ...currentEditorState,
        mediaAssetPage: page,
        mediaAssetPendingQuery: null,
        mediaAssetQuery: query,
      };
    },
  );
  storeMocks.hydrateLibrary.mockImplementation(async (query) => {
    currentSavedEditsState = {
      ...currentSavedEditsState,
      libraryPendingQuery: null,
      libraryQuery: query,
    };
  });
  storeMocks.setMediaPageIndex.mockImplementation((pageIndex: number) => {
    currentEditorState = {
      ...currentEditorState,
      mediaPageIndex: pageIndex,
    };
  });
  storeMocks.resetMediaPagination.mockImplementation(() => {
    currentEditorState = {
      ...currentEditorState,
      mediaPageIndex: 0,
      savedEditPageIndex: 0,
    };
  });
  storeMocks.setMediaFilter.mockImplementation((filter: string) => {
    currentEditorState = {
      ...currentEditorState,
      mediaFilter: filter,
      mediaPageIndex: 0,
      savedEditPageIndex: 0,
    };
  });
  storeMocks.setMediaRailTab.mockImplementation((tab: string) => {
    currentEditorState = {
      ...currentEditorState,
      mediaPageIndex: 0,
      ...(tab === "recently-clipped"
        ? { mediaRecentlyClippedSince: createRecentCutoff() }
        : {}),
      mediaRailTab: tab,
      savedEditPageIndex: 0,
    };
  });
  storeMocks.refreshMediaRecentlyClippedSince.mockImplementation(() => {
    const recentlyClippedSince = createRecentCutoff();
    currentEditorState = {
      ...currentEditorState,
      mediaRecentlyClippedSince: recentlyClippedSince,
    };

    return recentlyClippedSince;
  });
  storeMocks.setSavedEditPageIndex.mockImplementation((pageIndex: number) => {
    currentEditorState = {
      ...currentEditorState,
      savedEditPageIndex: pageIndex,
    };
  });
  currentEditorState = {
    clipboardState: { error: null, requestId: null, status: "idle" },
    exportState: { status: "idle" },
    hydrateMediaAssets: storeMocks.hydrateMediaAssets,
    mediaFilter: "death-clip",
    mediaRailTab: "all",
    mediaAssetPage: null,
    mediaAssetPendingQuery: null,
    mediaAssetQuery: null,
    mediaPageIndex: 0,
    mediaRecentlyClippedSince: createRecentCutoff(),
    project: createEditorTestProject(deathClip),
    refreshMediaRecentlyClippedSince:
      storeMocks.refreshMediaRecentlyClippedSince,
    resetMediaPagination: storeMocks.resetMediaPagination,
    savedEditPageIndex: 0,
    selectedAssetKey: null,
    setMediaFilter: storeMocks.setMediaFilter,
    setMediaPageIndex: storeMocks.setMediaPageIndex,
    setMediaRailTab: storeMocks.setMediaRailTab,
    setSavedEditPageIndex: storeMocks.setSavedEditPageIndex,
    workspace: {
      assets: [],
      hasMoreProjects: false,
      project: createEditorTestProject(deathClip),
      projects: [],
    },
    ...overrides,
  };
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector(currentEditorState),
  );
  currentSavedEditsState = {
    hydrateLibrary: storeMocks.hydrateLibrary,
    items: [
      {
        clipCount: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 12,
        historyEditCount: 1,
        id: "edit-1",
        sizeBytes: 1024,
        sourceGame: "poe2",
        sourceLeague: "Standard",
        title: "Saved edit 1",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    libraryPage: {
      availableLeagues: ["Standard"],
      globalTotalCount: 1,
      items: [],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      sortBy: "updatedAt",
      sortDirection: "desc",
      totalCount: 1,
    },
    libraryQuery: {
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
      sortBy: "updatedAt",
      sortDirection: "desc",
    },
    libraryPendingQuery: null,
    revealEditInExplorer: storeMocks.revealEditInExplorer,
  };
  storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
    selector(currentSavedEditsState),
  );
}

function createRecentCutoff(): string {
  return new Date(Date.now() - 60 * 60 * 1_000).toISOString();
}

function assetCardText(): string {
  return Array.from(container.querySelectorAll("[data-asset-card]"))
    .map((item) => item.textContent ?? "")
    .join(" ");
}

function savedEditCardText(): string {
  return Array.from(container.querySelectorAll("[data-saved-edit-card]"))
    .map((item) => item.textContent ?? "")
    .join(" ");
}

async function renderAssetRail() {
  await act(async () => {
    root.render(
      <EditorAssetRail scope={{ game: "poe2", league: "Standard" }} />,
    );
  });
}

async function renderHydratedAssetRail() {
  await renderAssetRail();
  await renderAssetRail();
}

describe("EditorAssetRail", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dndMocks.useDragOperation.mockReturnValue({ source: null });
    Object.assign(window, {
      electron: {
        recordingStorage: {
          getRecording: electronMocks.getRecording,
          revealRecording: electronMocks.revealRecording,
        },
        replayClips: {
          reveal: electronMocks.replayReveal,
        },
      },
    });
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("refreshes media and filters the visible media type", async () => {
    await renderHydratedAssetRail();
    const refreshButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh media"]',
    );
    const mediaSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Media type"]',
    );

    expect(
      container.querySelector('[data-onboarding="editor-my-media"]'),
    ).not.toBe(null);
    expect(container.querySelectorAll("[data-asset-card]")).toHaveLength(5);
    expect(assetCardText()).toContain("death-0.mp4");
    expect(assetCardText()).not.toContain("death.mp4");
    expect(assetCardText()).not.toContain("run.mp4");

    await act(async () => {
      refreshButton?.click();
      if (!mediaSelect) {
        throw new Error("Expected media selector to render");
      }
      mediaSelect.value = "recording";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderAssetRail();
    await renderAssetRail();

    expect(storeMocks.hydrateMediaAssets).toHaveBeenCalledWith({
      category: "death-clip",
      excludeAssetKeys: ["clip:death"],
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    });
    expect(assetCardText()).toContain("run.mp4");
    expect(assetCardText()).not.toContain("death.mp4");
  });

  it("blocks media rail actions while the editor is processing", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderHydratedAssetRail();
    storeMocks.hydrateMediaAssets.mockClear();
    storeMocks.setMediaFilter.mockClear();
    storeMocks.setMediaPageIndex.mockClear();
    storeMocks.setMediaRailTab.mockClear();

    const rail = container.querySelector<HTMLElement>(
      '[data-onboarding="editor-my-media"]',
    );
    const refreshButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh media"]',
    );
    const mediaSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Media type"]',
    );
    const timelineTab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    ).find((button) => button.textContent === "Timeline");
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next media page"]',
    );

    await act(async () => {
      refreshButton?.click();
      timelineTab?.click();
      nextButton?.click();
      if (!mediaSelect) {
        throw new Error("Expected media selector to render");
      }
      mediaSelect.value = "recording";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(rail?.getAttribute("aria-disabled")).toBe("true");
    expect(rail?.className).toContain("pointer-events-none");
    expect(refreshButton?.disabled).toBe(true);
    expect(mediaSelect?.disabled).toBe(true);
    expect(timelineTab?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(true);
    expect(storeMocks.hydrateMediaAssets).not.toHaveBeenCalled();
    expect(storeMocks.setMediaFilter).not.toHaveBeenCalled();
    expect(storeMocks.setMediaPageIndex).not.toHaveBeenCalled();
    expect(storeMocks.setMediaRailTab).not.toHaveBeenCalled();
  });

  it("keeps stale media rows visible while refreshing the page after a timeline change", async () => {
    const usedAsset = createEditorTestAsset({
      assetKey: "clip:used",
      category: "death-clip",
      id: "used",
      name: "used.mp4",
    });
    const remainingAsset = createEditorTestAsset({
      assetKey: "clip:remaining",
      category: "death-clip",
      id: "remaining",
      name: "remaining.mp4",
    });
    configureEditorState({
      mediaAssetPage: {
        items: [usedAsset, remainingAsset],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 5,
        totalCount: 2,
      },
      mediaAssetPendingQuery: {
        category: "death-clip",
        excludeAssetKeys: ["clip:used"],
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 5,
      },
      mediaAssetQuery: {
        category: "death-clip",
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 5,
      },
      project: createEditorTestProject(usedAsset),
    });
    storeMocks.hydrateMediaAssets.mockImplementation(
      () => new Promise(() => undefined),
    );

    await renderAssetRail();

    expect(assetCardText()).not.toContain("used.mp4");
    expect(assetCardText()).toContain("remaining.mp4");
    expect(container.textContent).not.toContain("No death clips available.");
  });

  it("locks media rail scrolling while dragging media", async () => {
    await renderHydratedAssetRail();
    dndMocks.useDragOperation.mockReturnValue({
      source: {
        data: {
          assetKey: "clip:death-0",
          kind: editorMediaAssetDragType,
        },
      },
    });

    await renderAssetRail();
    const scrollContainer = container.querySelector<HTMLDivElement>(
      "[data-editor-asset-scroll]",
    );
    if (!scrollContainer) {
      throw new Error("Expected media rail scroll container to render");
    }

    expect(scrollContainer.className).toContain("overflow-y-hidden");
    expect(scrollContainer.className).toContain("[scrollbar-gutter:stable]");
  });

  it("switches media rail tabs between timeline, recent, and all assets", async () => {
    await renderHydratedAssetRail();
    const tabList = container.querySelector<HTMLElement>(
      '[aria-label="Media scope"]',
    );
    const inTimelineTab = container.querySelector<HTMLButtonElement>(
      'button[role="tab"][aria-selected="false"]',
    );

    expect(tabList?.className).toContain("tabs-boxed");
    expect(tabList?.className).toContain("tabs-xs");

    await act(async () => {
      inTimelineTab?.click();
    });
    await renderAssetRail();
    await renderAssetRail();

    expect(currentEditorState.mediaRailTab).toBe("in-timeline");
    expect(storeMocks.hydrateMediaAssets).toHaveBeenLastCalledWith({
      category: "death-clip",
      game: "poe2",
      includeAssetKeys: ["clip:death"],
      pageIndex: 0,
      pageSize: 5,
    });
    expect(assetCardText()).toContain("death.mp4");

    const recentTab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    ).find((button) => button.textContent === "Recent");
    await act(async () => {
      recentTab?.click();
    });
    await renderAssetRail();

    expect(currentEditorState.mediaRailTab).toBe("recently-clipped");
    expect(storeMocks.hydrateMediaAssets.mock.lastCall?.[0]).toMatchObject({
      category: "death-clip",
      excludeAssetKeys: ["clip:death"],
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    });
    expect(
      storeMocks.hydrateMediaAssets.mock.lastCall?.[0].createdAfter,
    ).toEqual(expect.any(String));
  });

  it("refreshes the recent media cutoff when the recent tab is refreshed", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.parse("2026-06-28T12:00:00.000Z"));
      await renderHydratedAssetRail();

      const recentTab = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
      ).find((button) => button.textContent === "Recent");
      await act(async () => {
        recentTab?.click();
      });
      await renderAssetRail();

      expect(
        storeMocks.hydrateMediaAssets.mock.lastCall?.[0].createdAfter,
      ).toBe("2026-06-28T11:00:00.000Z");

      vi.setSystemTime(Date.parse("2026-06-28T13:00:00.000Z"));
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Refresh media"]',
          )
          ?.click();
      });

      expect(
        storeMocks.hydrateMediaAssets.mock.lastCall?.[0].createdAfter,
      ).toBe("2026-06-28T12:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves the in-timeline rail to the page containing the selected timeline clip", async () => {
    const timelineAssets = Array.from({ length: 6 }, (_, index) =>
      createEditorTestAsset({
        assetKey: index === 0 ? "clip:death" : `clip:death-${index - 1}`,
        category: "death-clip",
        id: index === 0 ? "death" : `death-${index - 1}`,
        name: index === 0 ? "death.mp4" : `death-${index - 1}.mp4`,
      }),
    );
    const selectedAsset = timelineAssets.at(-1)!;
    const project = createEditorTestProject(timelineAssets[0]!, {
      activeClipId: "timeline-selected",
      assets: timelineAssets,
      selectedAssetKey: selectedAsset.assetKey,
      tracks: [
        {
          id: "video-track",
          kind: "video",
          label: "Video",
          clips: timelineAssets.map((asset, index) =>
            createEditorTestTimelineClip(asset, {
              id:
                asset.assetKey === selectedAsset.assetKey
                  ? "timeline-selected"
                  : `timeline-${index}`,
              startSeconds: index * 5,
            }),
          ),
        },
      ],
    });
    configureEditorState({
      mediaRailTab: "in-timeline",
      project,
      selectedAssetKey: selectedAsset.assetKey,
      selectedClipId: "timeline-selected",
    });

    await renderHydratedAssetRail();

    expect(storeMocks.setMediaPageIndex).toHaveBeenCalledWith(1);
  });

  it("moves the in-timeline rail after the pending media page settles", async () => {
    const timelineAssets = Array.from({ length: 6 }, (_, index) =>
      createEditorTestAsset({
        assetKey: index === 0 ? "clip:death" : `clip:death-${index - 1}`,
        category: "death-clip",
        id: index === 0 ? "death" : `death-${index - 1}`,
        name: index === 0 ? "death.mp4" : `death-${index - 1}.mp4`,
      }),
    );
    const selectedAsset = timelineAssets.at(-1)!;
    const project = createEditorTestProject(timelineAssets[0]!, {
      activeClipId: "timeline-selected",
      assets: timelineAssets,
      selectedAssetKey: selectedAsset.assetKey,
      tracks: [
        {
          id: "video-track",
          kind: "video",
          label: "Video",
          clips: timelineAssets.map((asset, index) =>
            createEditorTestTimelineClip(asset, {
              id:
                asset.assetKey === selectedAsset.assetKey
                  ? "timeline-selected"
                  : `timeline-${index}`,
              startSeconds: index * 5,
            }),
          ),
        },
      ],
    });
    configureEditorState({
      mediaAssetPendingQuery: {
        category: "death-clip",
        game: "poe2",
        includeAssetKeys: timelineAssets.map((asset) => asset.assetKey),
        pageIndex: 0,
        pageSize: 5,
      },
      mediaRailTab: "in-timeline",
      project,
      selectedAssetKey: selectedAsset.assetKey,
      selectedClipId: "timeline-selected",
    });
    storeMocks.setMediaPageIndex.mockClear();

    await renderAssetRail();

    expect(storeMocks.setMediaPageIndex).not.toHaveBeenCalled();

    currentEditorState = {
      ...currentEditorState,
      mediaAssetPendingQuery: null,
    };
    await renderAssetRail();

    expect(storeMocks.setMediaPageIndex).toHaveBeenCalledWith(1);
  });

  it("shows manual replays and saved edits from the media selector", async () => {
    await renderHydratedAssetRail();
    const mediaSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Media type"]',
    );
    if (!mediaSelect) {
      throw new Error("Expected media selector to render");
    }

    await act(async () => {
      mediaSelect.value = "manual-replay";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderAssetRail();
    await renderAssetRail();

    expect(assetCardText()).toContain("manual.mp4");

    await act(async () => {
      mediaSelect.value = "saved-edits";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderAssetRail();

    expect(storeMocks.hydrateLibrary).toHaveBeenCalledWith({
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    expect(savedEditCardText()).toContain("Saved edit 1");
  });

  it("keeps the selected media filter when a timeline asset is selected", async () => {
    const selectedRecording = createEditorTestAsset({
      assetKey: "recording:selected",
      category: "recording",
      id: "selected-recording",
      kind: "recording",
      name: "selected-recording.mp4",
    });
    configureEditorState({
      project: createEditorTestProject(selectedRecording),
      selectedAssetKey: selectedRecording.assetKey,
    });
    await renderHydratedAssetRail();
    const mediaSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Media type"]',
    );
    if (!mediaSelect) {
      throw new Error("Expected media selector to render");
    }

    await act(async () => {
      mediaSelect.value = "saved-edits";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderAssetRail();

    expect(currentEditorState.mediaFilter).toBe("saved-edits");
    expect(savedEditCardText()).toContain("Saved edit 1");
  });

  it("opens the current media folder for each media filter", async () => {
    await renderHydratedAssetRail();
    const mediaSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Media type"]',
    );
    const revealButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Open current media folder in explorer"]',
    );
    if (!mediaSelect || !revealButton) {
      throw new Error("Expected media selector and reveal button to render");
    }

    await act(async () => {
      revealButton.click();
    });

    expect(electronMocks.replayReveal).toHaveBeenCalledWith("death-0");

    electronMocks.getRecording.mockResolvedValueOnce({
      mediaUrl: "hinekora-media://recording/run",
      recording: { path: "C:/Videos/run.mp4" },
    });
    await act(async () => {
      mediaSelect.value = "recording";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderAssetRail();
    await renderAssetRail();
    await act(async () => {
      revealButton.click();
    });

    expect(electronMocks.getRecording).toHaveBeenCalledWith("run");
    expect(electronMocks.revealRecording).toHaveBeenCalledWith(
      "C:/Videos/run.mp4",
    );

    await act(async () => {
      mediaSelect.value = "saved-edits";
      mediaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await renderAssetRail();
    await act(async () => {
      revealButton.click();
    });

    expect(storeMocks.revealEditInExplorer).toHaveBeenCalledWith("edit-1");
  });

  it("pages media rows from the footer controls", async () => {
    await renderHydratedAssetRail();
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next media page"]',
    );

    expect(container.querySelectorAll("[data-asset-card]")).toHaveLength(5);
    expect(nextButton?.disabled).toBe(false);

    await act(async () => {
      nextButton?.click();
    });
    expect(storeMocks.setMediaPageIndex).toHaveBeenCalledWith(1);

    await renderAssetRail();
    await renderAssetRail();

    expect(container.querySelectorAll("[data-asset-card]")).toHaveLength(1);
    expect(storeMocks.hydrateMediaAssets).toHaveBeenLastCalledWith({
      category: "death-clip",
      excludeAssetKeys: ["clip:death"],
      game: "poe2",
      league: "Standard",
      pageIndex: 1,
      pageSize: 5,
    });
  });

  it("does not page saved edits while the next saved edit page is pending", async () => {
    configureEditorState({
      mediaFilter: "saved-edits",
      savedEditPageIndex: 0,
    });
    currentSavedEditsState = {
      ...currentSavedEditsState,
      items: Array.from({ length: 5 }, (_, index) => ({
        clipCount: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 12,
        historyEditCount: 1,
        id: `edit-${index}`,
        sizeBytes: 1024,
        sourceGame: "poe2",
        sourceLeague: "Standard",
        title: `Saved edit ${index}`,
        updatedAt: "2026-06-18T00:00:00.000Z",
      })),
      libraryPage: {
        availableLeagues: ["Standard"],
        globalTotalCount: 10,
        items: [],
        pageCount: 2,
        pageIndex: 0,
        pageSize: 5,
        sortBy: "updatedAt",
        sortDirection: "desc",
        totalCount: 10,
      },
      libraryQuery: {
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 5,
        sortBy: "updatedAt",
        sortDirection: "desc",
      },
      libraryPendingQuery: {
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 5,
        sortBy: "updatedAt",
        sortDirection: "desc",
      },
    };
    await renderAssetRail();
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next media page"]',
    );

    await act(async () => {
      nextButton?.click();
    });

    expect(storeMocks.setSavedEditPageIndex).not.toHaveBeenCalled();
  });
});
