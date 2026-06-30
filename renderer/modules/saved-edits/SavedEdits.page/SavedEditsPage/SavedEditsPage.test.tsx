import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  deleteAllEdits: vi.fn(),
  useSavedEditsShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSavedEditsShallow: storeMocks.useSavedEditsShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
}));
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
const settingsSlice = {
  value: {
    activeGame: "poe2",
    poe1SelectedLeague: "Standard",
    poe2SelectedLeague: "Runes of Aldur",
  },
} as const;

describe("SavedEditsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
    storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
      selector({
        deleteAllEdits: storeMocks.deleteAllEdits,
        libraryPage: {
          availableLeagues: ["Runes of Aldur"],
          globalTotalCount: 2,
          totalCount: 2,
        },
      }),
    );
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

    expect(container.textContent).toContain("Saved Edits");
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
    storeMocks.useSavedEditsShallow.mockImplementation((selector) =>
      selector({
        deleteAllEdits: storeMocks.deleteAllEdits,
        libraryPage: {
          availableLeagues: ["Runes of Aldur"],
          globalTotalCount: 2,
          totalCount: 0,
        },
      }),
    );

    await act(async () => {
      root.render(<SavedEditsPage />);
    });

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete all edits",
    );

    expect(deleteButton?.disabled).toBe(false);
  });
});
