import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dndMocks = vi.hoisted(() => ({
  onDragEnd: null as ((event: Record<string, unknown>) => void) | null,
}));
const storeMocks = vi.hoisted(() => ({
  addAssetToTimelineAt: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: Record<string, unknown>) => void;
  }) => {
    dndMocks.onDragEnd = onDragEnd;

    return <div data-testid="drag-drop-provider">{children}</div>;
  },
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

import { createEditorTestProject } from "../../Editor.slice/Editor.slice.test-utils";
import {
  editorMediaAssetDragType,
  editorVideoTrackDropType,
} from "../../Editor.utils/Editor.utils";
import { EditorDragDropProvider } from "./EditorDragDropProvider";

let container: HTMLDivElement;
let root: Root;

function configureEditorState() {
  storeMocks.useEditorShallow.mockImplementation((selector) =>
    selector({
      addAssetToTimelineAt: storeMocks.addAssetToTimelineAt,
      project: createEditorTestProject(),
    }),
  );
}

async function renderProvider() {
  await act(async () => {
    root.render(
      <EditorDragDropProvider>
        <span>Editor</span>
      </EditorDragDropProvider>,
    );
  });
}

describe("EditorDragDropProvider", () => {
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
    dndMocks.onDragEnd = null;
  });

  it("drops media assets on the video track at the resolved timeline second", async () => {
    await renderProvider();

    act(() => {
      dndMocks.onDragEnd?.({
        canceled: false,
        nativeEvent: { clientX: 50 },
        operation: {
          source: {
            data: { assetKey: "clip:asset-1", kind: editorMediaAssetDragType },
          },
          target: {
            data: { kind: editorVideoTrackDropType, trackId: "video-track" },
            shape: {
              boundingRectangle: { left: 0, width: 100 },
            },
          },
        },
      });
    });

    expect(storeMocks.addAssetToTimelineAt).toHaveBeenCalledWith(
      "clip:asset-1",
      6.25,
    );
  });

  it("ignores canceled or non-editor drag events", async () => {
    await renderProvider();

    act(() => {
      dndMocks.onDragEnd?.({ canceled: true, operation: {} });
      dndMocks.onDragEnd?.({
        canceled: false,
        operation: {
          source: { data: { kind: "other" } },
          target: { data: { kind: editorVideoTrackDropType } },
        },
      });
    });

    expect(storeMocks.addAssetToTimelineAt).not.toHaveBeenCalled();
  });
});
