import { useEffect, useMemo, useRef } from "react";

import type { EditorMediaReference } from "~/main/modules/editor";
import { useEditorShallow } from "~/renderer/store";

import type { EditorRouteTrimDraft } from "../EditorPage.utils";

interface UseEditorRouteTrimDraftInput {
  draft: EditorRouteTrimDraft | null;
  isRouteHydrated: boolean;
  source: EditorMediaReference | null;
}

function useEditorRouteTrimDraft({
  draft,
  isRouteHydrated,
  source,
}: UseEditorRouteTrimDraftInput) {
  const applySingleClipTrimDraft = useEditorShallow(
    (editor) => editor.applySingleClipTrimDraft,
  );
  const appliedDraftKeyRef = useRef<string | null>(null);
  const draftKey = useMemo(() => {
    if (!source || !draft) {
      return null;
    }

    return [
      source.kind,
      source.id,
      draft.inSeconds,
      draft.outSeconds,
      draft.title ?? "",
    ].join(":");
  }, [draft, source]);

  useEffect(() => {
    if (!isRouteHydrated || !source || !draft || !draftKey) {
      return;
    }
    if (appliedDraftKeyRef.current === draftKey) {
      return;
    }

    appliedDraftKeyRef.current = draftKey;
    applySingleClipTrimDraft({
      inSeconds: draft.inSeconds,
      outSeconds: draft.outSeconds,
      source,
      title: draft.title ?? null,
    });
  }, [applySingleClipTrimDraft, draft, draftKey, isRouteHydrated, source]);
}

export { useEditorRouteTrimDraft };
