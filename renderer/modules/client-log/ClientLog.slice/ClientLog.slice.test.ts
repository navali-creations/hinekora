import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { ClientLogStatus } from "~/types";
import { createClientLogSlice } from "./ClientLog.slice";

const poe1Status: ClientLogStatus = {
  activeGame: "poe1",
  activeGameFocused: null,
  lastError: null,
  path: "C:\\PoE\\Client.txt",
  watching: true,
};

const poe2Status: ClientLogStatus = {
  activeGame: "poe2",
  activeGameFocused: null,
  lastError: null,
  path: "C:\\PoE2\\Client.txt",
  watching: true,
};

function createTestStore(
  settingsOverrides: Partial<BoundStore["settings"]> = {},
) {
  return createBoundStoreForTests((set, get, api) => {
    const clientLogSlice = createClientLogSlice(set, get, api);

    return {
      ...clientLogSlice,
      settings: {
        hydrate: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        value: { activeGame: "poe2" },
        ...settingsOverrides,
      },
    } as unknown as BoundStore;
  });
}

describe("ClientLog slice", () => {
  const getStatus = vi.fn();
  const setActiveGame = vi.fn();
  const setPath = vi.fn();
  const unsubscribe = vi.fn();
  let statusChangedListener: ((status: ClientLogStatus) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    statusChangedListener = null;
    getStatus.mockResolvedValue(poe1Status);
    setPath.mockResolvedValue(poe2Status);
    setActiveGame.mockResolvedValue(poe2Status);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        clientLog: {
          getStatus,
          setActiveGame,
          setPath,
          onStatusChanged: vi.fn(
            (listener: (status: ClientLogStatus) => void) => {
              statusChangedListener = listener;
              return unsubscribe;
            },
          ),
        },
      },
    });
  });

  it("hydrates, edits pending path, and saves the active game path", async () => {
    const store = createTestStore();

    await store.getState().clientLog.hydrate();
    store.getState().clientLog.setPendingPath("C:\\Manual\\Client.txt");
    await store.getState().clientLog.savePath();

    expect(setPath).toHaveBeenCalledWith({
      game: "poe2",
      path: "C:\\Manual\\Client.txt",
    });
    expect(store.getState().clientLog.status).toBe(poe2Status);
    expect(store.getState().clientLog.pendingPath).toBe(
      "C:\\Manual\\Client.txt",
    );
  });

  it("uses empty pending paths and poe1 when status and settings are missing", async () => {
    const store = createTestStore({
      value: null,
    });
    getStatus.mockResolvedValueOnce({ ...poe1Status, path: null });

    await store.getState().clientLog.hydrate();
    await store.getState().clientLog.savePath();

    expect(setPath).toHaveBeenCalledWith({
      game: "poe1",
      path: "",
    });
    expect(store.getState().clientLog.pendingPath).toBe("");
  });

  it("saves explicit paths and inactive game paths", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const store = createTestStore({
      update,
      value: { activeGame: "poe1" } as BoundStore["settings"]["value"],
    });

    await store.getState().clientLog.savePath("C:\\Explicit\\Client.txt");
    await store
      .getState()
      .clientLog.saveGamePath("poe2", "C:\\PoE2\\Client.txt");

    expect(setPath).toHaveBeenCalledWith({
      game: "poe1",
      path: "C:\\Explicit\\Client.txt",
    });
    expect(update).toHaveBeenCalledWith({
      poe2ClientTxtPath: "C:\\PoE2\\Client.txt",
    });
    const poe2Store = createTestStore({
      update,
      value: { activeGame: "poe2" } as BoundStore["settings"]["value"],
    });
    await poe2Store
      .getState()
      .clientLog.saveGamePath("poe1", "C:\\PoE\\Client.txt");
    expect(update).toHaveBeenCalledWith({
      poe1ClientTxtPath: "C:\\PoE\\Client.txt",
    });
  });

  it("saves the current game path, changes active game, and listens for status", async () => {
    const hydrateSettings = vi.fn().mockResolvedValue(undefined);
    const store = createTestStore({
      hydrate: hydrateSettings,
      value: { activeGame: "poe2" } as BoundStore["settings"]["value"],
    });
    setPath.mockResolvedValueOnce({ ...poe2Status, path: null });

    await store
      .getState()
      .clientLog.saveGamePath("poe2", "C:\\PoE2\\Client.txt");
    setActiveGame.mockResolvedValueOnce({ ...poe2Status, path: null });
    await store.getState().clientLog.setActiveGame("poe2");
    const stopListening = store.getState().clientLog.startListening();
    statusChangedListener?.({ ...poe1Status, path: null });
    stopListening();

    expect(setPath).toHaveBeenCalledWith({
      game: "poe2",
      path: "C:\\PoE2\\Client.txt",
    });
    expect(setActiveGame).toHaveBeenCalledWith({ game: "poe2" });
    expect(hydrateSettings).toHaveBeenCalledTimes(2);
    expect(store.getState().clientLog.pendingPath).toBe("");
    expect(store.getState().clientLog.status?.path).toBeNull();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("can switch the client-log watcher without hydrating settings", async () => {
    const hydrateSettings = vi.fn().mockResolvedValue(undefined);
    const store = createTestStore({
      hydrate: hydrateSettings,
    });

    await store
      .getState()
      .clientLog.setActiveGame("poe2", { hydrateSettings: false });

    expect(setActiveGame).toHaveBeenCalledWith({ game: "poe2" });
    expect(hydrateSettings).not.toHaveBeenCalled();
    expect(store.getState().clientLog.status).toBe(poe2Status);
  });
});
