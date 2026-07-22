import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  deleteAllEdits: vi.fn(),
  useSavedEditsShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

vi.mock("~/renderer/store", async () => {
  const { createPoeLeagueFixtureCatalog: createPoeLeagueTestCatalog } =
    await import("~/types/test-fixtures/poe-leagues");

  return {
    usePoeLeaguesShallow: (selector: (value: unknown) => unknown) =>
      selector({
        byGame: createPoeLeagueTestCatalog(),
        errors: {},
        isFetchingByGame: { poe1: false, poe2: false },
      }),
    useSavedEditsShallow: storeMocks.useSavedEditsShallow,
    useSettingsShallow: (selector: (settings: unknown) => unknown) =>
      storeMocks.useSettingsSelector((settings: unknown) =>
        selector({
          ...(settings as object),
          preferenceErrors: {},
          updatePreference: vi.fn(),
        }),
      ),
    useSettingsSelector: storeMocks.useSettingsSelector,
  };
});
vi.mock("~/renderer/components/PageContainer/PageContainer", () => ({
  PageContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("~/renderer/components/PageContent/PageContent", () => ({
  PageContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/renderer/components/PageHeader/PageHeader", () => ({
  PageHeader: ({
    actions,
    subtitle,
    title,
  }: {
    actions: ReactNode;
    subtitle: string;
    title: string;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions}
    </header>
  ),
}));
vi.mock(
  "~/renderer/modules/saved-edits/SavedEdits.components/SavedEditsPanel/SavedEditsPanel",
  () => ({
    SavedEditsPanel: () => <section data-testid="saved-edits-panel" />,
  }),
);

import { SavedEditsPage } from "./SavedEditsPage";

let container: HTMLDivElement;
let root: Root;
let settingsSlice = createSettingsSlice();

type TestGameId = "poe1" | "poe2";
type SavedEditsPageTestLibraryPage = {
  availableLeagues: string[];
  globalTotalCount: number;
  totalCount: number;
};
type SavedEditsPageTestLibraryQuery = {
  game: TestGameId;
  league?: string;
} | null;

interface SavedEditsPageStateOverrides {
  libraryPage?: SavedEditsPageTestLibraryPage | null;
  libraryQuery?: SavedEditsPageTestLibraryQuery;
}

function createSettingsSlice(activeGame: TestGameId = "poe2") {
  return {
    value: {
      activeGame,
      poe1SelectedLeague: "Standard",
      poe2SelectedLeague: "Runes of Aldur",
    },
  } as const;
}

function createLibraryPage(
  overrides: Partial<SavedEditsPageTestLibraryPage> = {},
): SavedEditsPageTestLibraryPage {
  return {
    availableLeagues: ["Runes of Aldur"],
    globalTotalCount: 2,
    totalCount: 2,
    ...overrides,
  };
}

function createLibraryQuery(
  overrides: Partial<NonNullable<SavedEditsPageTestLibraryQuery>> = {},
) {
  return {
    game: "poe2" as TestGameId,
    league: "Runes of Aldur",
    ...overrides,
  };
}

function getLibraryLeagueOptionValues() {
  return Array.from(
    container.querySelectorAll<HTMLOptionElement>(
      '[aria-label="Library league"] option',
    ),
  ).map((option) => option.value);
}

function mockSavedEditsState(
  getOverrides: () => SavedEditsPageStateOverrides = () => ({}),
) {
  storeMocks.useSavedEditsShallow.mockImplementation((selector) => {
    const overrides = getOverrides();

    return selector({
      deleteAllEdits: storeMocks.deleteAllEdits,
      libraryPage:
        overrides.libraryPage === undefined
          ? createLibraryPage()
          : overrides.libraryPage,
      libraryQuery:
        overrides.libraryQuery === undefined
          ? createLibraryQuery()
          : overrides.libraryQuery,
    });
  });
}

describe("SavedEditsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsSlice = createSettingsSlice();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
    mockSavedEditsState();
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector(settingsSlice),
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("renders the saved edits page and delete all action", async () => {
    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    expect(container.textContent).toContain("Draft Edits");
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe(
      "Runes of Aldur",
    );
    expect(
      container.querySelector("[data-testid='saved-edits-panel']"),
    ).not.toBe(null);

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete all edits")
        ?.click();
    });

    expect(document.body.textContent).toContain("Delete all edits?");

    await act(async () => {
      const dialog = document.body.querySelector<HTMLDialogElement>("dialog");
      Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.textContent === "Delete all edits")
        ?.click();
    });

    expect(storeMocks.deleteAllEdits).toHaveBeenCalled();
  });

  it("keeps the global delete action available when the current filter is empty", async () => {
    mockSavedEditsState(() => ({
      libraryPage: createLibraryPage({ totalCount: 0 }),
    }));

    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete all edits",
    );

    expect(deleteButton?.disabled).toBe(false);
  });

  it("keeps page actions stable while the selected league reloads", async () => {
    let libraryPage: SavedEditsPageTestLibraryPage | null = createLibraryPage();
    let libraryQuery: SavedEditsPageTestLibraryQuery = createLibraryQuery();
    mockSavedEditsState(() => ({ libraryPage, libraryQuery }));

    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    const leagueSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Library league"]',
    );
    leagueSelect?.focus();

    await act(async () => {
      libraryPage = null;
      libraryQuery = null;
      root.render(<SavedEditsPage />);
    });

    expect(document.activeElement).toBe(leagueSelect);
    expect(container.textContent).toContain("Delete all edits");
    expect(getLibraryLeagueOptionValues()).toContain("Runes of Aldur");
  });

  it("ignores saved edit metadata from a stale active-game page", async () => {
    mockSavedEditsState();

    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    expect(getLibraryLeagueOptionValues()).toContain("Runes of Aldur");

    settingsSlice = createSettingsSlice("poe1");
    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    expect(getLibraryLeagueOptionValues()).toContain("Mirage");
    expect(getLibraryLeagueOptionValues()).not.toContain("Runes of Aldur");
    expect(container.textContent).not.toContain("Delete all edits");
  });

  it("hides the global delete action when there are no saved edits", async () => {
    mockSavedEditsState(() => ({
      libraryPage: createLibraryPage({
        availableLeagues: [],
        globalTotalCount: 0,
        totalCount: 0,
      }),
    }));

    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    expect(container.textContent).not.toContain("Delete all edits");
  });
});
