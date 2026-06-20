import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
} from "../../Editor.slice/Editor.slice.test-utils";

const storeMocks = vi.hoisted(() => ({
  setPlaybackSeconds: vi.fn(),
  setPreviewPlaying: vi.fn(),
  useEditorShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useEditorShallow: storeMocks.useEditorShallow,
}));

vi.mock(
  "../../Editor.hooks/useEditorPreviewFrame/useEditorPreviewFrame",
  () => ({
    useEditorPreviewFrame: () => ({
      frameStyle: { height: 180, width: 320 },
      stageRef: { current: null },
    }),
  }),
);

import { EditorPreviewStage } from "./EditorPreviewStage";

const asset = createEditorTestAsset({ durationSeconds: 2 });
const project = createEditorTestProject(asset, {
  durationSeconds: 4,
  tracks: [
    {
      clips: [
        {
          assetKey: asset.assetKey,
          color: "primary",
          durationSeconds: 2,
          id: "timeline-1",
          inSeconds: 0,
          mediaUrl: asset.mediaUrl,
          name: asset.name,
          outSeconds: 2,
          startSeconds: 2,
          trackId: "video-track",
        },
      ],
      id: "video-track",
      kind: "video",
      label: "Video",
    },
  ],
});

describe("EditorPreviewStage", () => {
  beforeEach(() => {
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        isPreviewPlaying: false,
        playbackSeconds: 1,
        project,
        selectedAssetKey: "clip:asset-1",
        selectedClipId: null,
        setPlaybackSeconds: storeMocks.setPlaybackSeconds,
        setPreviewPlaying: storeMocks.setPreviewPlaying,
      }),
    );
  });

  it("shows an empty preview while the playhead is inside a timeline gap", () => {
    const html = renderToStaticMarkup(<EditorPreviewStage />);

    expect(html).not.toContain("<video");
    expect(html).toContain("No clip selected");
  });

  it("does not load a timeline clip at the playhead before selection", () => {
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        isPreviewPlaying: false,
        playbackSeconds: 2,
        project,
        selectedAssetKey: "clip:asset-1",
        selectedClipId: null,
        setPlaybackSeconds: storeMocks.setPlaybackSeconds,
        setPreviewPlaying: storeMocks.setPreviewPlaying,
      }),
    );

    const html = renderToStaticMarkup(<EditorPreviewStage />);

    expect(html).not.toContain("<video");
    expect(html).toContain("No clip selected");
  });

  it("loads the selected timeline clip preview", () => {
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        isPreviewPlaying: false,
        playbackSeconds: 2,
        project,
        selectedAssetKey: "clip:asset-1",
        selectedClipId: "timeline-1",
        setPlaybackSeconds: storeMocks.setPlaybackSeconds,
        setPreviewPlaying: storeMocks.setPreviewPlaying,
      }),
    );

    const html = renderToStaticMarkup(<EditorPreviewStage />);

    expect(html).toContain("<video");
    expect(html).toContain("hinekora-media://replay-clip/asset-1");
  });

  it("can still preview a selected media item before clips are on the timeline", () => {
    storeMocks.useEditorShallow.mockImplementation((selector) =>
      selector({
        isPreviewPlaying: false,
        playbackSeconds: 0,
        project: { ...project, durationSeconds: 0, tracks: [] },
        selectedAssetKey: "clip:asset-1",
        selectedClipId: null,
        setPlaybackSeconds: storeMocks.setPlaybackSeconds,
        setPreviewPlaying: storeMocks.setPreviewPlaying,
      }),
    );

    const html = renderToStaticMarkup(<EditorPreviewStage />);

    expect(html).toContain("<video");
    expect(html).toContain("hinekora-media://replay-clip/asset-1");
  });
});
