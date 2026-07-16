import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSettings, GameId } from "~/types";
import { createDefaultSettings } from "~/types";

const storeMocks = vi.hoisted(() => ({
  leagueNamesByGame: {
    poe1: ["Mirage", "Standard"],
    poe2: ["Runes of Aldur", "Standard"],
  },
  hasSynced: true,
  isFetching: false,
  settingsValue: null as AppSettings | null,
  preferenceError: null as string | null,
  updatePreference: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  usePoeLeaguesShallow: (selector: (value: unknown) => unknown) =>
    selector({
      byGame: {
        poe1: storeMocks.leagueNamesByGame.poe1.map((name) => ({ name })),
        poe2: storeMocks.leagueNamesByGame.poe2.map((name) => ({ name })),
      },
      isFetchingByGame: {
        poe1: storeMocks.isFetching,
        poe2: storeMocks.isFetching,
      },
      statusByGame: {
        poe1: {
          error: null,
          isFetching: storeMocks.isFetching,
          lastSyncedAt: storeMocks.hasSynced
            ? "2026-07-15T00:00:00.000Z"
            : null,
          provider: "test-provider",
        },
        poe2: {
          error: null,
          isFetching: storeMocks.isFetching,
          lastSyncedAt: storeMocks.hasSynced
            ? "2026-07-15T00:00:00.000Z"
            : null,
          provider: "test-provider",
        },
      },
    }),
  useSettingsShallow: storeMocks.useSettingsShallow,
}));

import { LeagueSelect } from "./LeagueSelect";

let container: HTMLDivElement;
let root: Root;

function setSettings(settings: Partial<AppSettings>): void {
  storeMocks.settingsValue = {
    ...createDefaultSettings(),
    ...settings,
  };
}

async function renderLeagueSelect(game: GameId): Promise<void> {
  await act(async () => {
    root.render(<LeagueSelect game={game} />);
    await Promise.resolve();
  });
}

function getLeagueSelect(): HTMLSelectElement {
  const select = container.querySelector<HTMLSelectElement>("select");
  if (!select) {
    throw new Error("Expected league select to render");
  }

  return select;
}

function getOptionLabels(): string[] {
  return Array.from(getLeagueSelect().options).map((option) => option.label);
}

describe("LeagueSelect", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    setSettings({});
    storeMocks.leagueNamesByGame.poe1 = ["Mirage", "Standard"];
    storeMocks.leagueNamesByGame.poe2 = ["Runes of Aldur", "Standard"];
    storeMocks.preferenceError = null;
    storeMocks.hasSynced = true;
    storeMocks.updatePreference.mockReset();
    storeMocks.isFetching = false;
    storeMocks.updatePreference.mockResolvedValue(true);
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        preferenceErrors: {
          ...(storeMocks.preferenceError
            ? { poe1SelectedLeague: storeMocks.preferenceError }
            : {}),
        },
        value: storeMocks.settingsValue ?? createDefaultSettings(),
        updatePreference: storeMocks.updatePreference,
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("uses provider-backed options and normalizes an ended league", async () => {
    storeMocks.leagueNamesByGame.poe1 = ["Next League", "Standard"];
    setSettings({ activeGame: "poe1", poe1SelectedLeague: "Mirage" });

    await renderLeagueSelect("poe1");

    expect(getOptionLabels()).toEqual(["Next League", "Standard"]);
    expect(getLeagueSelect().value).toBe("Next League");
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "poe1SelectedLeague",
      "Next League",
    );
  });

  it("keeps Standard after a successful Standard-only league gap", async () => {
    storeMocks.leagueNamesByGame.poe1 = ["Standard"];
    setSettings({ activeGame: "poe1", poe1SelectedLeague: "Mirage" });

    await renderLeagueSelect("poe1");

    expect(getLeagueSelect().value).toBe("Standard");
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "poe1SelectedLeague",
      "Standard",
    );

    setSettings({ activeGame: "poe1", poe1SelectedLeague: "Standard" });
    storeMocks.leagueNamesByGame.poe1 = ["Next League", "Standard"];
    storeMocks.updatePreference.mockClear();

    await renderLeagueSelect("poe1");

    expect(getLeagueSelect().value).toBe("Standard");
    expect(storeMocks.updatePreference).not.toHaveBeenCalled();
  });

  it("renders current PoE 1 league options", async () => {
    await renderLeagueSelect("poe1");

    expect(getOptionLabels()).toEqual(["Mirage", "Standard"]);
    expect(getLeagueSelect().className).toContain("cursor-pointer");
    expect(getLeagueSelect().className).toContain("focus:outline-none");
    expect(getLeagueSelect().parentElement?.className).toContain(
      "focus-within:outline-none",
    );
  });

  it("renders current PoE 2 league options", async () => {
    await renderLeagueSelect("poe2");

    expect(getOptionLabels()).toEqual(["Runes of Aldur", "Standard"]);
  });

  it("normalizes stale saved leagues through settings", async () => {
    setSettings({
      activeGame: "poe2",
      poe2SelectedLeague: "Dawn of the Hunt",
    });

    await renderLeagueSelect("poe2");

    expect(getLeagueSelect().value).toBe("Runes of Aldur");
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "poe2SelectedLeague",
      "Runes of Aldur",
    );
  });

  it("persists league changes for the active game", async () => {
    setSettings({
      activeGame: "poe2",
      poe2SelectedLeague: "Runes of Aldur",
    });
    await renderLeagueSelect("poe2");
    storeMocks.updatePreference.mockClear();

    await act(async () => {
      getLeagueSelect().value = "Standard";
      getLeagueSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "poe2SelectedLeague",
      "Standard",
    );
  });

  it("disables selection while the catalog is fetching", async () => {
    storeMocks.isFetching = true;

    await renderLeagueSelect("poe1");

    expect(getLeagueSelect().disabled).toBe(true);
  });

  it("does not persist a temporary fallback while the catalog is fetching", async () => {
    storeMocks.isFetching = true;
    storeMocks.leagueNamesByGame.poe1 = ["Standard"];
    setSettings({ activeGame: "poe1", poe1SelectedLeague: "Mirage" });

    await renderLeagueSelect("poe1");

    expect(getLeagueSelect().value).toBe("Standard");
    expect(storeMocks.updatePreference).not.toHaveBeenCalled();
  });

  it("does not persist a fallback after the first catalog refresh fails", async () => {
    storeMocks.hasSynced = false;
    storeMocks.leagueNamesByGame.poe1 = ["Standard"];
    setSettings({ activeGame: "poe1", poe1SelectedLeague: "Mirage" });

    await renderLeagueSelect("poe1");

    expect(getLeagueSelect().value).toBe("Standard");
    expect(storeMocks.updatePreference).not.toHaveBeenCalled();
  });

  it("surfaces preference persistence errors on the league control", async () => {
    storeMocks.preferenceError = "Could not save this preference.";

    await renderLeagueSelect("poe1");

    expect(getLeagueSelect().getAttribute("aria-invalid")).toBe("true");
    expect(getLeagueSelect().title).toBe("Could not save this preference.");
  });
});
