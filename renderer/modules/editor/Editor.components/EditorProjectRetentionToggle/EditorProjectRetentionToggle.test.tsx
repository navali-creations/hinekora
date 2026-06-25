import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  editorAutoPruneProjects: false,
  refreshMedia: vi.fn(),
  updateSettings: vi.fn(),
  useEditorShallow: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
  useSettingsShallow: storeMocks.useSettingsShallow,
}));

import { EditorProjectRetentionToggle } from "./EditorProjectRetentionToggle";

let container: HTMLDivElement;
let root: Root;

async function renderRetentionToggle(input: { disabled?: boolean } = {}) {
  const props =
    input.disabled === undefined ? {} : { disabled: input.disabled };

  await act(async () => {
    root.render(<EditorProjectRetentionToggle {...props} />);
  });
}

function getRetentionCheckbox(): HTMLInputElement {
  const checkbox = container.querySelector<HTMLInputElement>(
    'input[aria-label="Auto-prune all but last 5 edits"]',
  );
  if (!checkbox) {
    throw new Error("Expected editor project retention checkbox to render");
  }

  return checkbox;
}

describe("EditorProjectRetentionToggle", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.editorAutoPruneProjects = false;
    storeMocks.refreshMedia.mockReset();
    storeMocks.refreshMedia.mockResolvedValue(undefined);
    storeMocks.updateSettings.mockReset();
    storeMocks.updateSettings.mockResolvedValue(undefined);
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        refreshMedia: storeMocks.refreshMedia,
      }),
    );
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        update: storeMocks.updateSettings,
        value: {
          editorAutoPruneProjects: storeMocks.editorAutoPruneProjects,
        },
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("renders the saved editor project retention state", async () => {
    storeMocks.editorAutoPruneProjects = true;

    await renderRetentionToggle();

    expect(container.textContent).toContain("Auto-prune all but last 5");
    expect(getRetentionCheckbox().checked).toBe(true);
  });

  it("updates retention and refreshes editor media when toggled", async () => {
    await renderRetentionToggle();

    await act(async () => {
      getRetentionCheckbox().click();
      await Promise.resolve();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      editorAutoPruneProjects: true,
    });
    expect(storeMocks.refreshMedia).toHaveBeenCalledTimes(1);
  });

  it("disables the retention toggle when editor actions are disabled", async () => {
    await renderRetentionToggle({ disabled: true });

    expect(getRetentionCheckbox().disabled).toBe(true);
  });
});
