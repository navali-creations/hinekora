import type { SavedEditsLibraryQuery } from "~/main/modules/saved-edits";

function areSavedEditsLibraryQueriesEqual(
  first: SavedEditsLibraryQuery,
  second: SavedEditsLibraryQuery,
): boolean {
  return (
    areSavedEditsLibraryBaseQueriesEqual(first, second) &&
    (first.pageIndex ?? 0) === (second.pageIndex ?? 0) &&
    (first.pageSize ?? null) === (second.pageSize ?? null)
  );
}

function areSavedEditsLibraryAppendQueries(input: {
  current: SavedEditsLibraryQuery;
  next: SavedEditsLibraryQuery;
}): boolean {
  return (
    areSavedEditsLibraryBaseQueriesEqual(input.current, input.next) &&
    (input.current.pageSize ?? null) === (input.next.pageSize ?? null) &&
    (input.current.pageIndex ?? 0) + 1 === (input.next.pageIndex ?? 0)
  );
}

function areSavedEditsLibraryBaseQueriesEqual(
  first: SavedEditsLibraryQuery,
  second: SavedEditsLibraryQuery,
): boolean {
  return (
    (first.game ?? null) === (second.game ?? null) &&
    (first.league ?? null) === (second.league ?? null) &&
    (first.sortBy ?? null) === (second.sortBy ?? null) &&
    (first.sortDirection ?? null) === (second.sortDirection ?? null)
  );
}

export { areSavedEditsLibraryAppendQueries, areSavedEditsLibraryQueriesEqual };
