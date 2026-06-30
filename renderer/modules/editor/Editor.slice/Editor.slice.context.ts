import type { EditorProject } from "~/main/modules/editor";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import type { EditorSlice } from "./Editor.slice.types";

type EditorSliceSet = Parameters<BoundStoreStateCreator<EditorSlice>>[0];
type EditorSliceGet = Parameters<BoundStoreStateCreator<EditorSlice>>[1];

interface EditorSliceActionContext {
  get: EditorSliceGet;
  set: EditorSliceSet;
  setProject: (
    project: EditorProject,
    options?: {
      historyLabel?: string;
      historySubtitle?: string | null;
      recordHistory?: boolean;
      resetHistory?: boolean;
      resetViewState?: boolean;
    },
  ) => void;
  updateProject: (
    updater: (project: EditorProject) => EditorProject,
    options?: {
      historyLabel?: string;
      historySubtitle?: string | null;
      recordHistory?: boolean;
    },
  ) => void;
}

export type { EditorSliceActionContext };
