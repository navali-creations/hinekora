import { createFileRoute } from "@tanstack/react-router";

import type {
  EditorMediaKind,
  EditorMediaReference,
} from "~/main/modules/editor";
import { EditorPage } from "~/renderer/modules/editor/Editor.page/EditorPage/EditorPage";

interface EditorSearch {
  id?: string;
  kind?: EditorMediaKind;
}

function validateEditorSearch(search: Record<string, unknown>): EditorSearch {
  const kind =
    search.kind === "clip" || search.kind === "recording"
      ? search.kind
      : undefined;
  const id =
    typeof search.id === "string" && search.id.length > 0
      ? search.id
      : undefined;

  return {
    ...(id ? { id } : {}),
    ...(kind ? { kind } : {}),
  };
}

function EditorRoute() {
  const search = Route.useSearch();
  const source: EditorMediaReference | null =
    search.kind && search.id ? { id: search.id, kind: search.kind } : null;

  return <EditorPage source={source} />;
}

export const Route = createFileRoute("/editor")({
  component: EditorRoute,
  validateSearch: validateEditorSearch,
});
