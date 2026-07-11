import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  isProtocolHandled: vi.fn(),
  netFetch: vi.fn(),
  protocolHandle: vi.fn(),
}));

vi.mock("electron", () => ({
  net: { fetch: mocks.netFetch },
  protocol: {
    handle: mocks.protocolHandle,
    isProtocolHandled: mocks.isProtocolHandled,
  },
}));
vi.mock("~/main/utils/app-log", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.isProtocolHandled.mockReturnValue(false);
});

describe("MediaProtocol service diagnostics", () => {
  it("registers the protocol handler", async () => {
    const { setupMediaProtocol } = await import("../MediaProtocol.service");
    setupMediaProtocol({
      resolveClipPreviewPath: () => null,
      resolveReplayClipPath: () => null,
      resolveRunRecordingPath: () => null,
    });

    expect(mocks.protocolHandle).toHaveBeenCalledWith(
      "hinekora-media",
      expect.any(Function),
    );
    const handler = mocks.protocolHandle.mock.calls[0]?.[1] as (
      request: Request,
    ) => Promise<Response>;
    await expect(
      handler(new Request("https://example.test")),
    ).resolves.toMatchObject({
      status: 404,
    });
  });

  it("skips an existing handler and contains protocol setup failures", async () => {
    const { setupMediaProtocol } = await import("../MediaProtocol.service");
    const { protocol } = await import("electron");
    vi.mocked(protocol.isProtocolHandled).mockReturnValueOnce(true);

    setupMediaProtocol({
      resolveClipPreviewPath: () => null,
      resolveReplayClipPath: () => null,
      resolveRunRecordingPath: () => null,
    });
    expect(mocks.protocolHandle).not.toHaveBeenCalled();

    vi.mocked(protocol.isProtocolHandled).mockImplementationOnce(() => {
      throw new Error("protocol unavailable");
    });
    setupMediaProtocol({
      resolveClipPreviewPath: () => null,
      resolveReplayClipPath: () => null,
      resolveRunRecordingPath: () => null,
    });
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "media-protocol",
      "Media protocol setup failed",
      { error: "protocol unavailable" },
    );
  });

  it("logs completed media responses when diagnostics are enabled", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-protocol-"));
    const path = join(directory, "clip.mp4");
    await writeFile(path, "video");
    mocks.netFetch.mockResolvedValue(new Response("video"));
    vi.stubEnv("HINEKORA_CLIP_PREVIEW_DIAGNOSTICS", "1");

    try {
      const { handleMediaRequest } = await import("../MediaProtocol.service");
      const response = await handleMediaRequest(
        new Request("hinekora-media://replay-clip/clip-1"),
        {
          resolveClipPreviewPath: () => null,
          resolveReplayClipPath: () => path,
          resolveRunRecordingPath: () => null,
        },
      );

      expect(response.status).toBe(200);
      expect(mocks.logInfo).toHaveBeenCalledWith(
        "media-protocol",
        "Media response ready",
        expect.objectContaining({
          mediaId: "clip-1",
          mediaKind: "replay-clip",
          status: 200,
        }),
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("resolves clip preview proxy paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-protocol-"));
    const path = join(directory, "preview.mp4");
    await writeFile(path, "preview");
    mocks.netFetch.mockResolvedValue(new Response("preview"));
    try {
      const { handleMediaRequest } = await import("../MediaProtocol.service");
      const response = await handleMediaRequest(
        new Request("hinekora-media://clip-preview/clip-1"),
        {
          resolveClipPreviewPath: () => path,
          resolveReplayClipPath: () => null,
          resolveRunRecordingPath: () => null,
        },
      );

      expect(response.status).toBe(200);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns bounded responses for missing media and read failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hinekora-protocol-"));
    const path = join(directory, "recording.mp4");
    await writeFile(path, "video");
    try {
      const { handleMediaRequest } = await import("../MediaProtocol.service");
      const resolvers = {
        resolveClipPreviewPath: () => null,
        resolveReplayClipPath: () => null,
        resolveRunRecordingPath: () => path,
      };

      await expect(
        handleMediaRequest(
          new Request("hinekora-media://replay-clip/missing"),
          resolvers,
        ),
      ).resolves.toMatchObject({ status: 404 });

      mocks.netFetch.mockRejectedValueOnce(new Error("read failed"));
      await expect(
        handleMediaRequest(
          new Request("hinekora-media://run-recording/recording-1"),
          resolvers,
        ),
      ).resolves.toMatchObject({ status: 500 });
      expect(mocks.logWarn).toHaveBeenCalledWith(
        "media-protocol",
        "Media response failed",
        expect.objectContaining({
          error: "read failed",
          mediaId: "recording-1",
          mediaKind: "run-recording",
        }),
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
