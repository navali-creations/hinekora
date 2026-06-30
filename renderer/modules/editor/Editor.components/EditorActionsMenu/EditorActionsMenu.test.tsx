import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock("../EditorDeleteAllEditsAction/EditorDeleteAllEditsAction", () => ({
  EditorDeleteAllEditsAction: () => (
    <button type="button">Delete all edits</button>
  ),
}));
vi.mock("../EditorDeleteEditAction/EditorDeleteEditAction", () => ({
  EditorDeleteEditAction: ({ disabled }: { disabled?: boolean }) => (
    <button disabled={disabled} type="button">
      Delete edit
    </button>
  ),
}));
vi.mock("../EditorCopyActions/EditorCopyActions", () => ({
  EditorCopyActions: ({
    disabled,
    variant,
  }: {
    disabled?: boolean;
    variant: string;
  }) => (
    <button disabled={disabled} type="button">
      Copy {variant}
    </button>
  ),
}));
vi.mock("../EditorNewEditAction/EditorNewEditAction", () => ({
  EditorNewEditAction: ({
    disabled,
    variant,
  }: {
    disabled?: boolean;
    variant: string;
  }) => (
    <button disabled={disabled} type="button">
      New edit {variant}
    </button>
  ),
}));
vi.mock("../EditorProjectRetentionToggle/EditorProjectRetentionToggle", () => ({
  EditorProjectRetentionToggle: () => <label>Auto-prune all but last 5</label>,
}));
vi.mock("../EditorSaveActions/EditorSaveActions", () => ({
  EditorSaveActions: ({
    disabled,
    variant,
  }: {
    disabled?: boolean;
    variant: string;
  }) => (
    <button disabled={disabled} type="button">
      Save {variant}
    </button>
  ),
}));

import { EditorActionsMenu } from "./EditorActionsMenu";

let container: HTMLDivElement;
let root: Root;
const onToggleHistory = vi.fn();
const onToggleShortcuts = vi.fn();

function configureEditorState(overrides: Record<string, unknown> = {}) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      clipboardState: { error: null, requestId: null, status: "idle" },
      exportState: { status: "idle" },
      ...overrides,
    }),
  );
}

async function renderActionsMenu(isHistoryVisible: boolean) {
  await act(async () => {
    root.render(
      <EditorActionsMenu
        isHistoryVisible={isHistoryVisible}
        isShortcutsVisible={false}
        onToggleHistory={onToggleHistory}
        onToggleShortcuts={onToggleShortcuts}
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
    const menu = container.querySelector("ul");
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
      content.indexOf("Show shortcuts"),
    );
    expect(content.indexOf("Hide history")).toBeLessThan(
      content.indexOf("Delete edit"),
    );
    expect(content.indexOf("Delete edit")).toBeLessThan(
      content.indexOf("Delete all edits"),
    );
    expect(content.indexOf("Delete all edits")).toBeLessThan(
      content.indexOf("Auto-prune all but last 5"),
    );
    expect(content.indexOf("Auto-prune all but last 5")).toBeLessThan(
      content.indexOf("Debug"),
    );
    expect(content).toContain("Ctrl");
    expect(content).toContain("H");
    expect(menu?.className).toContain("p-2");
    expect(menu?.className).not.toContain("pr-3");
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

  it("toggles the shortcuts rail", async () => {
    await renderActionsMenu(false);
    const shortcutsButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Show shortcuts"));

    await act(async () => {
      shortcutsButton?.click();
    });

    expect(onToggleShortcuts).toHaveBeenCalledTimes(1);
  });

  it("disables processing actions while keeping menu toggles available", async () => {
    configureEditorState({
      clipboardState: { error: null, requestId: "copy-1", status: "copying" },
    });
    await renderActionsMenu(false);
    const summary = container.querySelector<HTMLElement>(
      '[aria-label="More editor actions"]',
    );
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Save menu"),
    );
    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Copy menu"),
    );
    const newEditButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("New edit menu"),
    );
    const deleteEditButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Delete edit"));
    const historyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Show history"),
    );

    await act(async () => {
      summary?.click();
      historyButton?.click();
    });

    expect(summary?.getAttribute("aria-disabled")).toBeNull();
    expect(summary?.className).not.toContain("btn-disabled");
    expect(saveButton?.disabled).toBe(true);
    expect(copyButton?.disabled).toBe(true);
    expect(newEditButton?.disabled).toBe(true);
    expect(deleteEditButton?.disabled).toBe(true);
    expect(onToggleHistory).toHaveBeenCalledTimes(1);
    expect(onToggleShortcuts).not.toHaveBeenCalled();
  });
});
