import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getEditorConfirmationDialog,
  getEditorDialogButton,
  installEditorDialogMocks,
} from "../EditorDeleteConfirmationModal/EditorDeleteConfirmationModal.test-utils";

const storeMocks = vi.hoisted(() => ({
  cancelExport: vi.fn(),
  closeExportCancellationConfirmation: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { EditorExportCancelConfirmationModal } from "./EditorExportCancelConfirmationModal";

let container: HTMLDivElement;
let root: Root;

function configureEditorState(isOpen: boolean) {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      cancelExport: storeMocks.cancelExport,
      closeExportCancellationConfirmation:
        storeMocks.closeExportCancellationConfirmation,
      exportState: { isCancelConfirmationOpen: isOpen },
    }),
  );
}

async function renderModal() {
  await act(async () => {
    root.render(<EditorExportCancelConfirmationModal />);
  });
}

describe("EditorExportCancelConfirmationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installEditorDialogMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    configureEditorState(false);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("renders only when requested and confirms cancellation", async () => {
    await renderModal();
    expect(document.body.querySelector("dialog")).toBe(null);

    configureEditorState(true);
    await renderModal();
    expect(getEditorConfirmationDialog().open).toBe(true);
    expect(getEditorConfirmationDialog().textContent).toContain(
      "unfinished video will be removed",
    );

    await act(async () => {
      getEditorDialogButton("Cancel processing").click();
    });
    expect(storeMocks.cancelExport).toHaveBeenCalledTimes(1);

    await act(async () => {
      getEditorDialogButton("Keep processing").click();
    });
    expect(
      storeMocks.closeExportCancellationConfirmation,
    ).toHaveBeenCalledTimes(1);
  });
});
