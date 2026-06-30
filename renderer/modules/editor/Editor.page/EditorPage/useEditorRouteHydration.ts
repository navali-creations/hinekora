import { useEffect, useRef } from "react";

import type {
  EditorMediaReference,
  EditorProject,
} from "~/main/modules/editor";

import { shouldHydrateEditorProject } from "./EditorPage.utils";

interface UseEditorRouteHydrationInput {
  hydrate: (source?: EditorMediaReference | null) => Promise<boolean>;
  openProject: (projectId: string) => Promise<boolean>;
  project: EditorProject | null;
  projectId: string | null;
  source: EditorMediaReference | null;
}

function useEditorRouteHydration({
  hydrate,
  openProject,
  project,
  projectId,
  source,
}: UseEditorRouteHydrationInput): void {
  const hydratedRouteKeyRef = useRef<string | null>(null);
  const sourceId = source?.id;
  const sourceKind = source?.kind;
  const sourceKey = sourceId && sourceKind ? `${sourceKind}:${sourceId}` : null;
  const routeProjectKey = projectId ? `project:${projectId}` : null;

  useEffect(() => {
    if (projectId && routeProjectKey) {
      if (hydratedRouteKeyRef.current === routeProjectKey) {
        return;
      }

      if (project?.id === projectId) {
        hydratedRouteKeyRef.current = routeProjectKey;
        return;
      }

      void Promise.resolve(openProject(projectId)).then((didOpenProject) => {
        if (didOpenProject) {
          hydratedRouteKeyRef.current = routeProjectKey;
        }
      });
      return;
    }

    if (!sourceKey) {
      hydratedRouteKeyRef.current = null;
      if (!project) {
        void hydrate(null);
      }
      return;
    }

    if (hydratedRouteKeyRef.current === sourceKey) {
      return;
    }

    if (
      project &&
      !shouldHydrateEditorProject({ project, sourceId, sourceKind })
    ) {
      hydratedRouteKeyRef.current = sourceKey;
      return;
    }

    void Promise.resolve(
      hydrate(
        sourceId && sourceKind ? { id: sourceId, kind: sourceKind } : null,
      ),
    ).then((didHydrate) => {
      if (didHydrate) {
        hydratedRouteKeyRef.current = sourceKey;
      }
    });
  }, [
    hydrate,
    openProject,
    project,
    projectId,
    routeProjectKey,
    sourceId,
    sourceKey,
    sourceKind,
  ]);
}

export { useEditorRouteHydration };
