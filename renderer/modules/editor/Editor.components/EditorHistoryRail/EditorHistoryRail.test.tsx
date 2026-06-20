import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock("../EditorHistoryActions/EditorHistoryActions", () => ({
  EditorHistoryActions: () => <div data-testid="history-actions" />,
}));

import { EditorHistoryRail } from "./EditorHistoryRail";

let container: HTMLDivElement;
let closeHistory: () => void;
let root: Root;

function configureEditorState(
  historyPast: unknown[] = [],
  historyPastLabels: string[] = [],
) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      historyPast,
      historyPastLabels,
    }),
  );
}

async function renderHistoryRail() {
  await act(async () => {
    root.render(<EditorHistoryRail onClose={closeHistory} />);
  });
}

describe("EditorHistoryRail", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    closeHistory = vi.fn();
    root = createRoot(container);
    configureEditorState();
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("shows an empty history state", async () => {
    await renderHistoryRail();

    expect(container.textContent).toContain("0 changes");
    expect(container.textContent).toContain("No history yet.");
    expect(container.querySelector("[data-testid='history-actions']")).not.toBe(
      null,
    );
  });

  it("closes the history panel from the header action", async () => {
    await renderHistoryRail();

    const closeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close history panel"]',
    );

    expect(closeButton?.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      "Close history panel",
    );

    await act(async () => {
      closeButton?.click();
    });

    expect(closeHistory).toHaveBeenCalledOnce();
  });

  it("shows latest history snapshots first", async () => {
    const asset = createEditorTestAsset();
    const firstProject = createEditorTestProject(asset, {
      durationSeconds: 2,
      id: "project-first",
      title: "First state",
    });
    const latestProject = createEditorTestProject(asset, {
      durationSeconds: 4,
      id: "project-latest",
      title: "Latest state",
    });
    configureEditorState(
      [firstProject, latestProject],
      ["Split", "Add boss.mp4"],
    );

    await renderHistoryRail();

    const content = container.textContent ?? "";
    expect(content.indexOf("Add boss.mp4")).toBeLessThan(
      content.indexOf("Split"),
    );
    expect(content).toContain("#2");
    expect(content).toContain("#1");
    expect(content).not.toContain("Latest state");
    expect(content).not.toContain("First state");
  });

  it("shows ten history entries before loading more", async () => {
    const asset = createEditorTestAsset();
    const history = Array.from({ length: 12 }, (_, index) =>
      createEditorTestProject(asset, {
        durationSeconds: index + 1,
        id: `project-${index + 1}`,
        title: `State ${index + 1}`,
      }),
    );
    const labels = history.map((_, index) => `Edit ${index + 1}`);
    configureEditorState(history, labels);

    await renderHistoryRail();

    expect(container.textContent).toContain("Edit 12");
    expect(container.textContent).toContain("Edit 3");
    expect(container.textContent).not.toContain("Edit 2");

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Load more");
    await act(async () => {
      loadMoreButton?.click();
    });

    expect(container.textContent).toContain("Edit 2");
    expect(container.textContent).toContain("Edit 1");
  });
});
