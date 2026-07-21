import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  keepEditingAfterExport: vi.fn(),
  openExportCancellationConfirmation: vi.fn(),
  useEditorShallow: vi.fn(),
  viewExport: vi.fn(),
}));

interface MockLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  children: ReactNode;
  to: string;
}

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: MockLinkProps) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorExportStatus } from "./EditorExportStatus";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(overrides: Record<string, unknown> = {}): void {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      exportState: {
        canCancel: true,
        error: null,
        isCancellationPending: false,
        progress: 0.42,
        status: "exporting",
      },
      openExportCancellationConfirmation:
        storeMocks.openExportCancellationConfirmation,
      keepEditingAfterExport: storeMocks.keepEditingAfterExport,
      viewExport: storeMocks.viewExport,
      ...overrides,
    }),
  );
}

async function renderStatus() {
  await act(async () => {
    root.render(<EditorExportStatus />);
  });
}

describe("EditorExportStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("shows background progress and routes its actions", async () => {
    await renderStatus();

    expect(container.textContent).toContain("Saving video");
    expect(container.textContent).toContain("42%");
    expect(
      container
        .querySelector('[aria-label="Background video export progress"]')
        ?.getAttribute("value"),
    ).toBe("42");
    expect(
      container.querySelector('[data-testid="media-processing-backdrop"]'),
    ).not.toBe(null);
    expect(
      container
        .querySelector('[data-testid="sidebar-editor-export-status"]')
        ?.className.includes("bg-"),
    ).toBe(false);
    const viewLink =
      container.querySelector<HTMLAnchorElement>('a[href="/editor"]');
    expect(viewLink?.classList.contains("btn-primary")).toBe(true);
    expect(viewLink?.classList.contains("btn-ghost")).toBe(false);

    await act(async () => {
      viewLink?.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      viewLink?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Cancel")
        ?.click();
    });

    expect(storeMocks.viewExport).toHaveBeenCalledTimes(1);
    expect(storeMocks.openExportCancellationConfirmation).toHaveBeenCalledTimes(
      1,
    );
  });

  it("hides when idle and disables cancellation while stopping", async () => {
    configureEditorState({
      exportState: {
        canCancel: false,
        isCancellationPending: false,
        progress: 0,
        status: "idle",
      },
    });
    await renderStatus();
    expect(container.childElementCount).toBe(0);

    configureEditorState({
      exportState: {
        canCancel: true,
        isCancellationPending: true,
        progress: 0.5,
        status: "exporting",
      },
    });
    await renderStatus();
    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Stopping",
    );
    expect(cancelButton?.disabled).toBe(true);
  });

  it("keeps completed and failed background exports accessible", async () => {
    configureEditorState({
      exportState: {
        canCancel: false,
        error: null,
        isCancellationPending: false,
        progress: 1,
        status: "ready",
      },
    });
    await renderStatus();
    expect(container.textContent).toContain("Video saved");
    expect(container.textContent).toContain("100%");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Dismiss")
        ?.click();
    });
    expect(storeMocks.keepEditingAfterExport).toHaveBeenCalledTimes(1);

    configureEditorState({
      exportState: {
        canCancel: false,
        error: "Temporary video files could not be removed",
        isCancellationPending: false,
        progress: 0,
        status: "failed",
      },
    });
    await renderStatus();
    expect(container.textContent).toContain("Save failed");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Temporary video files could not be removed",
    );
    expect(container.querySelector('a[href="/editor"]')).not.toBeNull();
  });
});
