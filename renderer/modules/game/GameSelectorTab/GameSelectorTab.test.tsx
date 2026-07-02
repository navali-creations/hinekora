import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSettings, GameId } from "~/types";
import { createDefaultSettings } from "~/types";
import { GameSelectorTab } from "./GameSelectorTab";

const storeMocks = vi.hoisted(() => ({
  selectCaptureProfileForGame: vi.fn(),
  setActiveClientLogGame: vi.fn(),
  settingsValue: null as AppSettings | null,
}));

vi.mock("~/renderer/modules/game/GameStatusBadge/GameStatusBadge", () => ({
  GameStatusBadge: ({ game }: { game: GameId }) => (
    <span>{game === "poe1" ? "PoE 1 status" : "PoE 2 status"}</span>
  ),
}));

vi.mock("~/renderer/modules/game/LeagueSelect/LeagueSelect", () => ({
  LeagueSelect: ({ disabled, game }: { disabled?: boolean; game: GameId }) => (
    <select aria-label={`${game} league`} disabled={disabled}>
      <option>Standard</option>
    </select>
  ),
}));

vi.mock("~/renderer/store", () => ({
  useCaptureProfilesShallow: <T,>(
    selector: (captureProfiles: {
      selectForGame: (game: GameId) => Promise<void>;
    }) => T,
  ) =>
    selector({
      selectForGame: storeMocks.selectCaptureProfileForGame,
    }),
  useClientLogSelector: <T,>(
    selector: (clientLog: {
      setActiveGame: (
        game: GameId,
        options?: { hydrateSettings?: boolean },
      ) => Promise<void>;
    }) => T,
  ) =>
    selector({
      setActiveGame: storeMocks.setActiveClientLogGame,
    }),
  useSettingsShallow: <T,>(
    selector: (settings: { value: AppSettings | null }) => T,
  ) =>
    selector({
      value: storeMocks.settingsValue,
    }),
}));

let container: HTMLDivElement;
let root: Root;

async function renderTab(game: GameId): Promise<void> {
  await act(async () => {
    root.render(<GameSelectorTab game={game} />);
  });
}

describe("GameSelectorTab", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.settingsValue = createDefaultSettings();
    storeMocks.selectCaptureProfileForGame.mockResolvedValue(undefined);
    storeMocks.setActiveClientLogGame.mockResolvedValue(undefined);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("keeps game tabs clickable and switches the capture profile game", async () => {
    await renderTab("poe1");

    const gameButton = container.querySelector<HTMLButtonElement>("button");
    const leagueSelect = container.querySelector<HTMLSelectElement>("select");

    expect(gameButton?.disabled).toBe(false);
    expect(leagueSelect?.disabled).toBe(false);

    await act(async () => {
      gameButton?.click();
    });

    expect(storeMocks.selectCaptureProfileForGame).toHaveBeenCalledWith("poe1");
    expect(storeMocks.setActiveClientLogGame).toHaveBeenCalledWith("poe1", {
      hydrateSettings: false,
    });
  });

  it("marks the active game tab", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      activeGame: "poe1",
    };

    await renderTab("poe1");

    expect(container.querySelector("[role='tab']")?.className).toContain(
      "tab-active",
    );
  });
});
