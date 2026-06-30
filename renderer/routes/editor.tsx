import { createFileRoute } from "@tanstack/react-router";

import type {
  EditorMediaKind,
  EditorMediaReference,
} from "~/main/modules/editor";
import { EditorPage } from "~/renderer/modules/editor/Editor.page/EditorPage/EditorPage";

interface EditorSearch {
  id?: string;
  kind?: EditorMediaKind;
  projectId?: string;
}

const editorRouteMaxMediaIdLength = 2_048;
const editorRouteMaxProjectIdLength = 128;

function validateEditorSearch(search: Record<string, unknown>): EditorSearch {
  const kind: EditorMediaKind | null =
    search.kind === "clip" || search.kind === "recording" ? search.kind : null;
  const id = validateEditorSearchString(search.id, editorRouteMaxMediaIdLength);
  const projectId =
    validateEditorSearchString(
      search.projectId,
      editorRouteMaxProjectIdLength,
    ) ?? undefined;
  const result: EditorSearch = {};

  if (kind && id) {
    result.id = id;
    result.kind = kind;
  }

  if (projectId) {
    result.projectId = projectId;
  }

  return result;
}

function validateEditorSearchString(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value.length <= maxLength ? value : null;
}

function EditorRoute() {
  const search = Route.useSearch();
  const source: EditorMediaReference | null =
    search.kind && search.id ? { id: search.id, kind: search.kind } : null;

  return <EditorPage projectId={search.projectId ?? null} source={source} />;
}

export const Route = createFileRoute("/editor")({
  component: EditorRoute,
  validateSearch: validateEditorSearch,
});

export { validateEditorSearch };
