import { createFileRoute } from "@tanstack/react-router";

import type {
  EditorMediaKind,
  EditorMediaReference,
} from "~/main/modules/editor";
import { EditorPage } from "~/renderer/modules/editor/Editor.page/EditorPage/EditorPage";
import type { EditorRouteTrimDraft } from "~/renderer/modules/editor/Editor.page/EditorPage/EditorPage.utils";

interface EditorSearch {
  id?: string;
  kind?: EditorMediaKind;
  projectId?: string;
  title?: string;
  trimIn?: number;
  trimOut?: number;
}

const editorRouteMaxMediaIdLength = 2_048;
const editorRouteMaxProjectIdLength = 128;
const editorRouteMaxTitleLength = 120;
const editorRouteMaxTrimSeconds = 3_600;
const editorRouteMinimumTrimSeconds = 0.1;

function validateEditorSearch(search: Record<string, unknown>): EditorSearch {
  const kind: EditorMediaKind | null =
    search.kind === "clip" || search.kind === "recording" ? search.kind : null;
  const id = validateEditorSearchString(search.id, editorRouteMaxMediaIdLength);
  const projectId =
    validateEditorSearchString(
      search.projectId,
      editorRouteMaxProjectIdLength,
    ) ?? undefined;
  const title =
    validateEditorSearchString(search.title, editorRouteMaxTitleLength) ??
    undefined;
  const trimIn = validateEditorSearchNumber(search.trimIn);
  const trimOut = validateEditorSearchNumber(search.trimOut);
  const result: EditorSearch = {};

  if (kind && id) {
    result.id = id;
    result.kind = kind;
    if (
      trimIn !== null &&
      trimOut !== null &&
      trimIn >= 0 &&
      trimOut <= editorRouteMaxTrimSeconds &&
      trimOut - trimIn >= editorRouteMinimumTrimSeconds
    ) {
      result.trimIn = trimIn;
      result.trimOut = trimOut;
      if (title) {
        result.title = title;
      }
    }
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

function validateEditorSearchNumber(value: unknown): number | null {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numberValue)
    ? Math.round(numberValue * 1_000) / 1_000
    : null;
}

function EditorRoute() {
  const search = Route.useSearch();
  const source: EditorMediaReference | null =
    search.kind && search.id ? { id: search.id, kind: search.kind } : null;
  const initialTrimDraft: EditorRouteTrimDraft | null =
    source && search.trimIn !== undefined && search.trimOut !== undefined
      ? {
          inSeconds: search.trimIn,
          outSeconds: search.trimOut,
          title: search.title ?? null,
        }
      : null;

  return (
    <EditorPage
      initialTrimDraft={initialTrimDraft}
      projectId={search.projectId ?? null}
      source={source}
    />
  );
}

export const Route = createFileRoute("/editor")({
  component: EditorRoute,
  validateSearch: validateEditorSearch,
});

export { validateEditorSearch };
