import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFetching: false,
  isRunning: false,
  path: "C:\\Games\\Path of Exile\\logs\\Client.txt",
}));

vi.mock("~/renderer/store", () => ({
  usePoeLeaguesShallow: (selector: (value: unknown) => unknown) =>
    selector({
      isFetchingByGame: { poe1: mocks.isFetching, poe2: false },
    }),
  usePoeProcessSelector: (selector: (value: unknown) => unknown) =>
    selector({
      states: {
        poe1: { game: "poe1", isRunning: mocks.isRunning },
        poe2: { game: "poe2", isRunning: false },
      },
    }),
  useSettingsSelector: (selector: (value: unknown) => unknown) =>
    selector({ value: { poe1ClientTxtPath: mocks.path } }),
}));

import { GameStatusBadge } from "./GameStatusBadge";

let container: HTMLDivElement;
let root: Root;

async function renderBadge(): Promise<void> {
  await act(async () => {
    root.render(<GameStatusBadge game="poe1" />);
  });
}

describe("GameStatusBadge", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    mocks.isFetching = false;
    mocks.isRunning = false;
    mocks.path = "C:\\Games\\Path of Exile\\logs\\Client.txt";
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("shows running and offline process states", async () => {
    mocks.isRunning = true;
    await renderBadge();
    expect(container.textContent).toContain("Running");

    mocks.isRunning = false;
    await renderBadge();
    expect(container.textContent).toContain("Offline");
    expect(container.querySelector("span")?.className).toContain(
      "text-zinc-400",
    );
    expect(container.querySelector("span")?.className).not.toContain(
      "badge-neutral",
    );
  });

  it("prioritizes the spinning league fetching state", async () => {
    mocks.isFetching = true;
    mocks.isRunning = true;
    await renderBadge();

    expect(container.textContent).toContain("Fetching");
    expect(
      container.querySelector("svg")?.classList.contains("animate-spin"),
    ).toBe(true);
  });

  it("explains when Client.txt is not configured", async () => {
    mocks.path = "";
    await renderBadge();

    expect(container.querySelector("span")?.title).toContain(
      "Client.txt is not configured",
    );
  });
});
