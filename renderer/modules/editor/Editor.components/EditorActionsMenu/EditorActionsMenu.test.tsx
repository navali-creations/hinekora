import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../EditorCopyActions/EditorCopyActions", () => ({
  EditorCopyActions: ({ variant }: { variant: string }) => (
    <button type="button">Copy {variant}</button>
  ),
}));
vi.mock("../EditorDeleteEditAction/EditorDeleteEditAction", () => ({
  EditorDeleteEditAction: () => <button type="button">Delete edit</button>,
}));
vi.mock("../EditorNewEditAction/EditorNewEditAction", () => ({
  EditorNewEditAction: ({ variant }: { variant: string }) => (
    <button type="button">New edit {variant}</button>
  ),
}));
vi.mock("../EditorSaveActions/EditorSaveActions", () => ({
  EditorSaveActions: ({ variant }: { variant: string }) => (
    <button type="button">Save {variant}</button>
  ),
}));

import { EditorActionsMenu } from "./EditorActionsMenu";

let container: HTMLDivElement;
let root: Root;
const onToggleHistory = vi.fn();

async function renderActionsMenu(isHistoryVisible: boolean) {
  await act(async () => {
    root.render(
      <EditorActionsMenu
        isHistoryVisible={isHistoryVisible}
        onToggleHistory={onToggleHistory}
      />,
    );
  });
}

describe("EditorActionsMenu", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("renders compact editor actions in the menu", async () => {
    await renderActionsMenu(true);
    const content = container.textContent ?? "";
    const dividers = container.querySelectorAll('li[aria-hidden="true"]');

    expect(
      container.querySelector('[data-onboarding="editor-more-options"]'),
    ).not.toBe(null);
    expect(content.indexOf("Save menu")).toBeLessThan(
      content.indexOf("Copy menu"),
    );
    expect(content.indexOf("Copy menu")).toBeLessThan(
      content.indexOf("New edit menu"),
    );
    expect(content.indexOf("New edit menu")).toBeLessThan(
      content.indexOf("Hide history"),
    );
    expect(content.indexOf("Hide history")).toBeLessThan(
      content.indexOf("Delete edit"),
    );
    expect(dividers).toHaveLength(3);
  });

  it("toggles the history rail", async () => {
    await renderActionsMenu(false);
    const historyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Show history"),
    );

    await act(async () => {
      historyButton?.click();
    });

    expect(onToggleHistory).toHaveBeenCalledTimes(1);
  });
});
