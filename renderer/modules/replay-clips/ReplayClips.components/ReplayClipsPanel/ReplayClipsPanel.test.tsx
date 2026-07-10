import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayClipView } from "~/main/modules/replay-clips";
import { createReplayClipView } from "~/main/test/factories/replayClip";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  clearSelectedClips: vi.fn(),
  hydrateLibrary: vi.fn(),
  setSelectedClipIds: vi.fn(),
  useReplayClipsShallow: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMocks.navigate,
}));

vi.mock("~/renderer/store", () => ({
  useReplayClipsShallow: storeMocks.useReplayClipsShallow,
}));

import { ReplayClipsPanel } from "./ReplayClipsPanel";

let container: HTMLDivElement;
let root: Root;

function configureReplayClipsStore(items: ReplayClipView[]) {
  storeMocks.useReplayClipsShallow.mockImplementation((selector) =>
    selector({
      clearSelectedClips: storeMocks.clearSelectedClips,
      error: null,
      hydrateLibrary: storeMocks.hydrateLibrary,
      libraryItems: items,
      libraryPage: {
        availableLeagues: [],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 20,
        sortBy: "createdAt",
        sortDirection: "desc",
        totalCount: items.length,
      },
      selectedClipIds: {},
      setSelectedClipIds: storeMocks.setSelectedClipIds,
    }),
  );
}

function findRowByText(text: string): HTMLTableRowElement {
  const row = Array.from(container.querySelectorAll("tbody tr")).find((item) =>
    item.textContent?.includes(text),
  );
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`Could not find row containing ${text}`);
  }

  return row;
}

async function renderPanel() {
  await act(async () => {
    root.render(
      <ReplayClipsPanel
        query={{ kind: "death" }}
        queryKey="death"
        showLeagueColumn={false}
      />,
    );
  });
}

describe("ReplayClipsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("disables row navigation and dims unavailable clips", async () => {
    configureReplayClipsStore([
      createReplayClipView({
        id: "playable",
        fileName: "playable.mp4",
        hasMediaFile: true,
        sizeBytes: 1024,
      }),
      createReplayClipView({
        id: "missing",
        fileName: "missing.mp4",
        hasMediaFile: false,
        sizeBytes: 0,
      }),
    ]);

    await renderPanel();

    const playableRow = findRowByText("playable.mp4");
    const missingRow = findRowByText("missing.mp4");

    expect(playableRow.getAttribute("role")).toBe("button");
    expect(missingRow.getAttribute("role")).toBe(null);
    expect(missingRow.className).toContain("text-base-content/45");

    await act(async () => {
      missingRow.click();
    });

    expect(routerMocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      playableRow.click();
    });

    expect(routerMocks.navigate).toHaveBeenCalledWith({
      params: { clipId: "playable" },
      to: "/clip/$clipId",
    });
  });
});
