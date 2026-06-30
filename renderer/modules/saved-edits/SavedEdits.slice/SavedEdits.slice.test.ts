import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SavedEditItem,
  SavedEditsLibraryPage,
} from "~/main/modules/saved-edits";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createSavedEditsSlice } from "./SavedEdits.slice";

function createSavedEdit(
  overrides: Partial<SavedEditItem> = {},
): SavedEditItem {
  return {
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
    ...overrides,
  };
}

function createLibraryPage(
  items: SavedEditItem[] = [],
  overrides: Partial<SavedEditsLibraryPage> = {},
): SavedEditsLibraryPage {
  return {
    availableLeagues: ["Standard"],
    globalTotalCount: items.length,
    items,
    pageCount: 1,
    pageIndex: 0,
    pageSize: 20,
    sortBy: "updatedAt",
    sortDirection: "desc",
    totalCount: items.length,
    ...overrides,
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createSavedEditsSlice(set, get, api) as unknown as BoundStore,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe("SavedEdits slice", () => {
  const deleteEdit = vi.fn();
  const deleteAll = vi.fn();
  const listLibrary = vi.fn();
  const revealInExplorer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    deleteEdit.mockResolvedValue(undefined);
    deleteAll.mockResolvedValue(undefined);
    listLibrary.mockResolvedValue(createLibraryPage());
    revealInExplorer.mockResolvedValue({ status: "success", error: null });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        savedEdits: {
          delete: deleteEdit,
          deleteAll,
          listLibrary,
          revealInExplorer,
        },
      },
    });
  });

  it("hydrates and refreshes the saved edits library", async () => {
    const edit = createSavedEdit();
    listLibrary.mockResolvedValue(createLibraryPage([edit]));
    const store = createTestStore();

    await store.getState().savedEdits.refreshLibrary();
    expect(listLibrary).not.toHaveBeenCalled();

    await store
      .getState()
      .savedEdits.hydrateLibrary({ pageSize: 20, sortBy: "updatedAt" });
    await store.getState().savedEdits.refreshLibrary();

    expect(store.getState().savedEdits).toMatchObject({
      error: null,
      items: [edit],
      libraryPage: createLibraryPage([edit]),
      libraryQuery: { pageSize: 20, sortBy: "updatedAt" },
    });
    expect(listLibrary).toHaveBeenLastCalledWith({
      pageSize: 20,
      sortBy: "updatedAt",
    });
  });

  it("ignores stale saved edit library responses", async () => {
    const staleEdit = createSavedEdit({
      id: "stale-edit",
      sourceGame: "poe1",
      title: "Stale edit",
    });
    const currentEdit = createSavedEdit({
      id: "current-edit",
      sourceGame: "poe2",
      title: "Current edit",
    });
    const stalePage = createDeferred<SavedEditsLibraryPage>();
    const currentPage = createDeferred<SavedEditsLibraryPage>();
    listLibrary
      .mockReturnValueOnce(stalePage.promise)
      .mockReturnValueOnce(currentPage.promise);
    const store = createTestStore();

    const staleRequest = store
      .getState()
      .savedEdits.hydrateLibrary({ game: "poe1" });
    const currentRequest = store
      .getState()
      .savedEdits.hydrateLibrary({ game: "poe2" });

    currentPage.resolve(createLibraryPage([currentEdit]));
    await currentRequest;
    stalePage.resolve(createLibraryPage([staleEdit]));
    await staleRequest;

    expect(store.getState().savedEdits.items).toEqual([currentEdit]);
    expect(store.getState().savedEdits.libraryQuery).toEqual({ game: "poe2" });
  });

  it("ignores stale saved edit library failures", async () => {
    const currentEdit = createSavedEdit({
      id: "current-edit",
      sourceGame: "poe2",
      title: "Current edit",
    });
    const stalePage = createDeferred<SavedEditsLibraryPage>();
    const currentPage = createDeferred<SavedEditsLibraryPage>();
    listLibrary
      .mockReturnValueOnce(stalePage.promise)
      .mockReturnValueOnce(currentPage.promise);
    const store = createTestStore();

    const staleRequest = store
      .getState()
      .savedEdits.hydrateLibrary({ game: "poe1" });
    const currentRequest = store
      .getState()
      .savedEdits.hydrateLibrary({ game: "poe2" });

    currentPage.resolve(createLibraryPage([currentEdit]));
    await currentRequest;
    stalePage.reject(new Error("stale library failed"));
    await staleRequest;

    expect(store.getState().savedEdits.error).toBeNull();
    expect(store.getState().savedEdits.items).toEqual([currentEdit]);
  });

  it("appends sequential saved edit library pages", async () => {
    const firstEdit = createSavedEdit({ id: "edit-1", title: "Edit 1" });
    const secondEdit = createSavedEdit({ id: "edit-2", title: "Edit 2" });
    listLibrary
      .mockResolvedValueOnce(
        createLibraryPage([firstEdit], {
          pageCount: 2,
          pageIndex: 0,
          pageSize: 5,
          totalCount: 6,
        }),
      )
      .mockResolvedValueOnce(
        createLibraryPage([secondEdit], {
          pageCount: 2,
          pageIndex: 1,
          pageSize: 5,
          totalCount: 6,
        }),
      );
    const store = createTestStore();

    await store.getState().savedEdits.hydrateLibrary({
      pageIndex: 0,
      pageSize: 5,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    await store.getState().savedEdits.hydrateLibrary(
      {
        pageIndex: 1,
        pageSize: 5,
        sortBy: "updatedAt",
        sortDirection: "desc",
      },
      { mode: "append" },
    );

    expect(store.getState().savedEdits.items).toEqual([firstEdit, secondEdit]);
    expect(store.getState().savedEdits.libraryPage).toMatchObject({
      items: [firstEdit, secondEdit],
      pageIndex: 1,
      pageSize: 5,
      totalCount: 6,
    });
  });

  it("replaces saved edit library rows for table paging", async () => {
    const firstEdit = createSavedEdit({ id: "edit-1", title: "Edit 1" });
    const secondEdit = createSavedEdit({ id: "edit-2", title: "Edit 2" });
    listLibrary
      .mockResolvedValueOnce(
        createLibraryPage([firstEdit], {
          pageCount: 2,
          pageIndex: 0,
          pageSize: 1,
          totalCount: 2,
        }),
      )
      .mockResolvedValueOnce(
        createLibraryPage([secondEdit], {
          pageCount: 2,
          pageIndex: 1,
          pageSize: 1,
          totalCount: 2,
        }),
      );
    const store = createTestStore();

    await store.getState().savedEdits.hydrateLibrary({
      pageIndex: 0,
      pageSize: 1,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    await store.getState().savedEdits.hydrateLibrary({
      pageIndex: 1,
      pageSize: 1,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    expect(store.getState().savedEdits.items).toEqual([secondEdit]);
    expect(store.getState().savedEdits.libraryPage).toMatchObject({
      items: [secondEdit],
      pageIndex: 1,
      pageSize: 1,
      totalCount: 2,
    });
  });

  it("does not append non-sequential saved edit library responses", async () => {
    const firstEdit = createSavedEdit({ id: "edit-1", title: "Edit 1" });
    const thirdEdit = createSavedEdit({ id: "edit-3", title: "Edit 3" });
    listLibrary
      .mockResolvedValueOnce(
        createLibraryPage([firstEdit], {
          pageCount: 3,
          pageIndex: 0,
          pageSize: 1,
          totalCount: 3,
        }),
      )
      .mockResolvedValueOnce(
        createLibraryPage([thirdEdit], {
          pageCount: 3,
          pageIndex: 2,
          pageSize: 1,
          totalCount: 3,
        }),
      );
    const store = createTestStore();

    await store.getState().savedEdits.hydrateLibrary({
      pageIndex: 0,
      pageSize: 1,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    await store.getState().savedEdits.hydrateLibrary(
      {
        pageIndex: 2,
        pageSize: 1,
        sortBy: "updatedAt",
        sortDirection: "desc",
      },
      { mode: "append" },
    );

    expect(store.getState().savedEdits.items).toEqual([thirdEdit]);
    expect(store.getState().savedEdits.libraryPage?.pageIndex).toBe(2);
  });

  it("deletes saved edits and refreshes the active library query", async () => {
    const store = createTestStore();

    await store
      .getState()
      .savedEdits.hydrateLibrary({ pageSize: 20, sortBy: "updatedAt" });
    await store.getState().savedEdits.deleteEdit("project-1");
    await store.getState().savedEdits.deleteAllEdits();

    expect(deleteEdit).toHaveBeenCalledWith("project-1");
    expect(deleteAll).toHaveBeenCalledTimes(1);
    expect(listLibrary).toHaveBeenCalledTimes(3);
  });

  it("stores saved edit delete failures", async () => {
    const store = createTestStore();

    deleteEdit.mockRejectedValueOnce("delete failed");
    await store.getState().savedEdits.deleteEdit("project-1");
    expect(store.getState().savedEdits.error).toBe("Saved edits failed");

    deleteEdit.mockRejectedValueOnce(new Error("delete failed"));
    await store.getState().savedEdits.deleteEdit("project-1");
    expect(store.getState().savedEdits.error).toBe("delete failed");

    deleteAll.mockRejectedValueOnce(new Error("delete all failed"));
    await store.getState().savedEdits.deleteAllEdits();
    expect(store.getState().savedEdits.error).toBe("delete all failed");

    deleteAll.mockRejectedValueOnce("delete all failed");
    await store.getState().savedEdits.deleteAllEdits();
    expect(store.getState().savedEdits.error).toBe("Saved edits failed");
  });

  it("reveals saved edit sources and stores reveal errors", async () => {
    const store = createTestStore();

    await store.getState().savedEdits.revealEditInExplorer("project-1");
    expect(revealInExplorer).toHaveBeenCalledWith("project-1");
    expect(store.getState().savedEdits.error).toBe(null);

    revealInExplorer.mockResolvedValueOnce({
      status: "unavailable",
      error: "Saved edit source media is not available",
    });
    await store.getState().savedEdits.revealEditInExplorer("project-2");

    expect(store.getState().savedEdits.error).toBe(
      "Saved edit source media is not available",
    );

    revealInExplorer.mockResolvedValueOnce({
      status: "unavailable",
      error: null,
    });
    await store.getState().savedEdits.revealEditInExplorer("project-3");
    expect(store.getState().savedEdits.error).toBe(
      "Saved edit source is unavailable",
    );

    revealInExplorer.mockRejectedValueOnce("reveal failed");
    await store.getState().savedEdits.revealEditInExplorer("project-4");
    expect(store.getState().savedEdits.error).toBe("Saved edits failed");
  });

  it("stores fallback errors", async () => {
    const store = createTestStore();

    listLibrary.mockRejectedValueOnce("failed");
    await store.getState().savedEdits.hydrateLibrary({});
    expect(store.getState().savedEdits.error).toBe("Saved edits failed");

    listLibrary.mockResolvedValueOnce(createLibraryPage());
    await store.getState().savedEdits.hydrateLibrary({});
    listLibrary.mockRejectedValueOnce(new Error("Saved edits exploded"));
    await store.getState().savedEdits.refreshLibrary();
    expect(store.getState().savedEdits.error).toBe("Saved edits exploded");
  });
});
