import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSettings, GameId } from "~/types";
import { createDefaultSettings } from "~/types";
import { GameSelectorTab } from "./GameSelectorTab";

const storeMocks = vi.hoisted(() => ({
  isRecorderActive: false,
  recorderActiveGame: null as GameId | null,
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
  useManagedRecorderShallow: <T,>(
    selector: (managedRecorder: { status: unknown }) => T,
  ) =>
    selector({
      status: {
        activeGame: storeMocks.recorderActiveGame,
        bufferActive: storeMocks.isRecorderActive,
        recording: storeMocks.isRecorderActive,
        runRecordingActive: storeMocks.isRecorderActive,
      },
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
    storeMocks.isRecorderActive = false;
    storeMocks.recorderActiveGame = null;
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
    expect(gameButton?.className).toContain("border-0");
    expect(gameButton?.className).toContain("shadow-none");
    expect(gameButton?.className).toContain("focus-visible:outline-none");
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

  it("disables inactive game switching while recording or rewind is active", async () => {
    storeMocks.isRecorderActive = true;
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      activeGame: "poe2",
    };

    await renderTab("poe1");

    const gameButton = container.querySelector<HTMLButtonElement>("button");
    const leagueSelect = container.querySelector<HTMLSelectElement>("select");

    expect(gameButton?.disabled).toBe(true);
    expect(gameButton?.title).toBe(
      "Stop recording or rewind before switching games",
    );
    expect(leagueSelect?.disabled).toBe(true);

    await act(async () => {
      gameButton?.click();
    });

    expect(storeMocks.selectCaptureProfileForGame).not.toHaveBeenCalled();
    expect(storeMocks.setActiveClientLogGame).not.toHaveBeenCalled();
  });

  it("uses the recorder session game instead of mutable settings while recording", async () => {
    storeMocks.isRecorderActive = true;
    storeMocks.recorderActiveGame = "poe2";
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      activeGame: "poe1",
    };

    await renderTab("poe1");

    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
      true,
    );
    expect(container.querySelector("[role='tab']")?.className).not.toContain(
      "tab-active",
    );

    await renderTab("poe2");

    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(
      false,
    );
    expect(container.querySelector("[role='tab']")?.className).toContain(
      "tab-active",
    );
  });
});
