import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorExportNoticeId } from "../../Editor.slice/Editor.slice.types";

const storeMocks = vi.hoisted(() => ({
  dismissExportNotice: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorExportNotices } from "./EditorExportNotices";

let container: HTMLDivElement;
let dismissedNoticeIds: EditorExportNoticeId[];
let root: Root;

describe("EditorExportNotices", () => {
  beforeEach(() => {
    dismissedNoticeIds = [];
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        dismissExportNotice: storeMocks.dismissExportNotice,
        exportState: { dismissedNoticeIds },
      }),
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("explains background work, cancellation cleanup, and edit isolation", async () => {
    await act(async () => {
      root.render(<EditorExportNotices />);
    });

    expect(container.textContent).toContain("keep using Hinekora");
    expect(container.textContent).toContain("unfinished video is removed");
    expect(container.textContent).toContain(
      "Changes apply only to your next video",
    );
    expect(container.textContent).toContain("Save and Copy to clipboard");
    const notices = container.querySelectorAll('[role="status"]');
    expect(notices).toHaveLength(3);
    expect(notices[0]?.textContent).toContain("Keep using Hinekora");
    expect(notices[1]?.textContent).toContain("Keep editing safely");
    expect(notices[2]?.textContent).toContain("Cancel without leftovers");
    expect(container.querySelectorAll("svg.text-info")).toHaveLength(3);
  });

  it("dismisses individual notices and hides the section when all are dismissed", async () => {
    await act(async () => {
      root.render(<EditorExportNotices />);
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Dismiss keep editing safely notice"]',
        )
        ?.click();
    });
    expect(storeMocks.dismissExportNotice).toHaveBeenCalledWith(
      "keep-editing-safely",
    );

    dismissedNoticeIds = [
      "cancel-without-leftovers",
      "keep-editing-safely",
      "keep-using-hinekora",
    ];
    await act(async () => {
      root.render(<EditorExportNotices />);
    });
    expect(
      container.querySelector('[aria-label="Video processing information"]'),
    ).toBe(null);
  });
});
