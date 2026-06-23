import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

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

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      clipboardState: { error: null, requestId: null, status: "idle" },
      ...overrides,
    }),
  );
}

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
    configureEditorState();
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

  it("disables the menu while copying to clipboard", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderActionsMenu(false);
    const summary = container.querySelector<HTMLElement>(
      '[aria-label="More editor actions"]',
    );
    const historyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Show history"),
    );

    await act(async () => {
      summary?.click();
      historyButton?.click();
    });

    expect(summary?.getAttribute("aria-disabled")).toBe("true");
    expect(summary?.className).toContain("btn-disabled");
    expect(onToggleHistory).not.toHaveBeenCalled();
  });
});
