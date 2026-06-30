import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SavedEditItem,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
} from "~/main/modules/saved-edits";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({
  hydrateLibrary: vi.fn(),
  useSavedEditsShallow: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMocks.navigate,
}));
vi.mock("~/renderer/store", () => ({
  useSavedEditsShallow: storeMocks.useSavedEditsShallow,
}));

import { SavedEditsPanel } from "./SavedEditsPanel";

const savedEdit: SavedEditItem = {
  clipCount: 2,
  createdAt: "2026-06-18T00:00:00.000Z",
  durationSeconds: 65,
  historyEditCount: 3,
  id: "project-1",
  sizeBytes: 1024,
  sourceGame: "poe2",
  sourceLeague: "Standard",
  title: "Boss attempt edit",
  updatedAt: "2026-06-18T00:05:00.000Z",
};
const libraryPage: SavedEditsLibraryPage = {
  availableLeagues: ["Standard"],
  globalTotalCount: 1,
  items: [savedEdit],
  pageCount: 1,
  pageIndex: 0,
  pageSize: 20,
  sortBy: "updatedAt",
  sortDirection: "desc",
  totalCount: 1,
};

let container: HTMLDivElement;
let root: Root;

function configureSavedEditsState(
  pageOverrides: Partial<SavedEditsLibraryPage> = {},
  libraryQueryOverrides: Partial<SavedEditsLibraryQuery> = {},
) {
  const page = { ...libraryPage, ...pageOverrides };
  storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
    selector({
      error: null,
      hydrateLibrary: storeMocks.hydrateLibrary,
      items: page.items,
      libraryPage: page,
      libraryQuery: {
        game: "poe2",
        league: "Standard",
        pageIndex: page.pageIndex,
        pageSize: page.pageSize,
        sortBy: page.sortBy,
        sortDirection: page.sortDirection,
        ...libraryQueryOverrides,
      },
    }),
  );
}

describe("SavedEditsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureSavedEditsState();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("renders saved edits in the shared table and opens rows", async () => {
    await act(async () => {
      root.render(
        <SavedEditsPanel scope={{ game: "poe2", league: "Standard" }} />,
      );
    });

    expect(container.textContent).toContain("Boss attempt edit");
    expect(container.textContent).toContain("Size");
    expect(container.textContent).toContain("History");
    expect(container.textContent).toContain("3 edits");
    expect(
      Array.from(container.querySelectorAll("thead th")).map((header) =>
        header.textContent?.trim(),
      ),
    ).toEqual([
      "Name",
      "Updated",
      "Created",
      "Length",
      "Size",
      "History",
      "Actions",
    ]);
    expect(container.textContent).not.toContain("FPS");
    expect(container.textContent).not.toContain("Resolution");
    expect(container.textContent).not.toContain("Clips");
    expect(container.textContent).toContain("Showing 1 to 1 of 1 results");
    expect(storeMocks.hydrateLibrary).toHaveBeenCalledWith({
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 20,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    await act(async () => {
      container.querySelector("tbody tr")?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
        }),
      );
    });

    expect(routerMocks.navigate).toHaveBeenCalledWith({
      search: { projectId: "project-1" },
      to: "/editor",
    });
  });

  it("resets pagination when the library scope changes", async () => {
    configureSavedEditsState({ pageCount: 3, totalCount: 41 });
    await act(async () => {
      root.render(
        <SavedEditsPanel scope={{ game: "poe2", league: "Standard" }} />,
      );
    });
    storeMocks.hydrateLibrary.mockClear();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Next page"]')
        ?.click();
    });

    expect(storeMocks.hydrateLibrary).toHaveBeenLastCalledWith({
      game: "poe2",
      league: "Standard",
      pageIndex: 1,
      pageSize: 20,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    storeMocks.hydrateLibrary.mockClear();

    await act(async () => {
      root.render(
        <SavedEditsPanel scope={{ game: "poe2", league: "Mirage" }} />,
      );
    });

    expect(storeMocks.hydrateLibrary).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydrateLibrary).toHaveBeenLastCalledWith({
      game: "poe2",
      league: "Mirage",
      pageIndex: 0,
      pageSize: 20,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  });

  it("adopts the page index returned by the library after results shrink", async () => {
    configureSavedEditsState({ pageCount: 3, totalCount: 41 });
    await act(async () => {
      root.render(
        <SavedEditsPanel scope={{ game: "poe2", league: "Standard" }} />,
      );
    });
    storeMocks.hydrateLibrary.mockClear();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Next page"]')
        ?.click();
    });

    expect(storeMocks.hydrateLibrary).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 1 }),
    );
    storeMocks.hydrateLibrary.mockClear();
    configureSavedEditsState(
      { pageCount: 1, pageIndex: 0, totalCount: 1 },
      { pageIndex: 1 },
    );

    await act(async () => {
      root.render(
        <SavedEditsPanel scope={{ game: "poe2", league: "Standard" }} />,
      );
    });

    expect(container.textContent).toContain("Page 1 of 1");
    expect(storeMocks.hydrateLibrary).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 0 }),
    );
  });
});
