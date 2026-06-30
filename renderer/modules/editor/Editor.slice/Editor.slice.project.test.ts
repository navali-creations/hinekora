import { describe, expect, it } from "vitest";

import {
  createEditorTestProject,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore } = setupEditorSliceTest();

describe("Editor project slice", () => {
  it("toggles project audio mute state and records history", () => {
    const store = createTestStore();
    const project = createEditorTestProject();
    loadEditorProject(store, project);

    store.getState().editor.toggleProjectAudioMuted();

    expect(store.getState().editor.project?.isAudioMuted).toBe(true);
    expect(store.getState().editor.historyPastLabels).toEqual(["Mute audio"]);

    store.getState().editor.toggleProjectAudioMuted();

    expect(store.getState().editor.project?.isAudioMuted).toBe(false);
    expect(store.getState().editor.historyPastLabels).toEqual([
      "Mute audio",
      "Unmute audio",
    ]);
  });

  it("ignores audio mute toggles when no project is loaded", () => {
    const store = createTestStore();

    store.getState().editor.toggleProjectAudioMuted();

    expect(store.getState().editor.project).toBeNull();
    expect(store.getState().editor.historyPastLabels).toEqual([]);
  });
});
