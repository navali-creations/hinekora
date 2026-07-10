import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchLocalFileForTests } from "~/main/test/local-file-fetch";

import {
  createReplayClipMediaFileResponse as createMediaFileResponse,
  createReplayClipMediaUrl,
  createRunRecordingMediaUrl,
  resolveHinekoraMediaRequestTarget,
} from "../ReplayClips.media";

function createReplayClipMediaFileResponse(path: string, request: Request) {
  return createMediaFileResponse(path, request, fetchLocalFileForTests);
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-replay-media-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("ReplayClips.media", () => {
  it("builds and resolves app media URLs", () => {
    expect(createReplayClipMediaUrl("clip one")).toBe(
      "hinekora-media://replay-clip/clip%20one",
    );
    expect(createRunRecordingMediaUrl("recording-1")).toBe(
      "hinekora-media://run-recording/recording-1",
    );
    expect(
      resolveHinekoraMediaRequestTarget(
        "hinekora-media://run-recording/recording-1",
      ),
    ).toEqual({ id: "recording-1", kind: "run-recording" });
    expect(
      resolveHinekoraMediaRequestTarget(
        `hinekora-media://run-recording/${"x".repeat(129)}`,
      ),
    ).toBe(null);
    expect(
      resolveHinekoraMediaRequestTarget("hinekora-media://other/item"),
    ).toBe(null);
  });

  it("serves media responses for full, head, and byte-range requests", async () => {
    const path = join(root, "clip.mp4");
    writeFileSync(path, "abcdef");

    const fullResponse = await createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1"),
    );
    expect(fullResponse.status).toBe(200);
    expect(fullResponse.headers.get("Accept-Ranges")).toBe("bytes");
    expect(fullResponse.headers.get("Content-Length")).toBe("6");
    expect(fullResponse.headers.get("Content-Type")).toBe("video/mp4");
    await expect(fullResponse.text()).resolves.toBe("abcdef");

    const headResponse = await createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", { method: "HEAD" }),
    );
    expect(headResponse.status).toBe(200);
    expect(headResponse.body).toBeNull();

    const rangeResponse = await createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=1-3" },
      }),
    );
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get("Content-Length")).toBe("3");
    expect(rangeResponse.headers.get("Content-Range")).toBe("bytes 1-3/6");
    await expect(rangeResponse.text()).resolves.toBe("bcd");

    const suffixResponse = await createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=-2" },
      }),
    );
    expect(suffixResponse.status).toBe(206);
    expect(suffixResponse.headers.get("Content-Range")).toBe("bytes 4-5/6");
    await expect(suffixResponse.text()).resolves.toBe("ef");

    const openEndedResponse = await createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=3-" },
      }),
    );
    expect(openEndedResponse.status).toBe(206);
    expect(openEndedResponse.headers.get("Content-Range")).toBe("bytes 3-5/6");
    await expect(openEndedResponse.text()).resolves.toBe("def");

    const clippedEndResponse = await createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=2-99" },
      }),
    );
    expect(clippedEndResponse.status).toBe(206);
    expect(clippedEndResponse.headers.get("Content-Range")).toBe("bytes 2-5/6");
    await expect(clippedEndResponse.text()).resolves.toBe("cdef");
  });

  it("rejects empty, directory, and invalid range media requests", async () => {
    const emptyPath = join(root, "empty.mp4");
    const directoryPath = join(root, "directory.mp4");
    const path = join(root, "clip.mp4");
    writeFileSync(emptyPath, "");
    mkdirSync(directoryPath);
    writeFileSync(path, "abcdef");

    expect(
      (
        await createReplayClipMediaFileResponse(
          emptyPath,
          new Request("hinekora-media://replay-clip/clip-1"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await createReplayClipMediaFileResponse(
          directoryPath,
          new Request("hinekora-media://replay-clip/clip-1"),
        )
      ).status,
    ).toBe(404);

    for (const range of [
      "items=1-2",
      "bytes=-",
      "bytes=-0",
      "bytes=5-4",
      "bytes=6-",
    ]) {
      const response = await createReplayClipMediaFileResponse(
        path,
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range },
        }),
      );
      expect(response.status).toBe(416);
      expect(response.headers.get("Accept-Ranges")).toBe("bytes");
      expect(response.headers.get("Content-Range")).toBe("bytes */6");
    }
  });

  it("maps known media extensions to browser content types", async () => {
    const cases = [
      ["clip.mov", "video/quicktime"],
      ["clip.webm", "video/webm"],
      ["clip.mkv", "video/x-matroska"],
      ["clip.flv", "application/octet-stream"],
    ] as const;

    for (const [fileName, contentType] of cases) {
      const path = join(root, fileName);
      writeFileSync(path, "video");

      expect(
        (
          await createReplayClipMediaFileResponse(
            path,
            new Request("hinekora-media://replay-clip/clip-1", {
              method: "HEAD",
            }),
          )
        ).headers.get("Content-Type"),
      ).toBe(contentType);
    }
  });

  it("forwards ranges through the native file fetch and restricts CORS origins", async () => {
    const path = join(root, "clip.mp4");
    writeFileSync(path, "0123456789abcdefghijklmnopqrstuvwxyz");
    const fetchFile = vi.fn<
      (url: string, init: RequestInit) => Promise<Response>
    >(async () => new Response("abcdefghijk", { status: 200 }));
    const allowedResponse = await createMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: {
          origin: "http://localhost:5173",
          range: "bytes=10-20",
        },
      }),
      fetchFile,
    );

    expect(fetchFile).toHaveBeenCalledWith(
      expect.stringMatching(/^file:/),
      expect.objectContaining({ method: "GET" }),
    );
    const fetchHeaders = new Headers(fetchFile.mock.calls[0]?.[1]?.headers);
    expect(fetchHeaders.get("Range")).toBe("bytes=10-20");
    expect(allowedResponse.status).toBe(206);
    expect(allowedResponse.headers.get("Content-Length")).toBe("11");
    expect(allowedResponse.headers.get("Content-Range")).toBe("bytes 10-20/36");
    await expect(allowedResponse.text()).resolves.toBe("abcdefghijk");
    expect(allowedResponse.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );

    const blockedResponse = await createMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { origin: "https://example.test" },
      }),
      fetchFile,
    );
    expect(blockedResponse.status).toBe(403);

    const methodResponse = await createMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", { method: "POST" }),
      fetchFile,
    );
    expect(methodResponse.status).toBe(405);
  });

  it("propagates response-body cancellation to the native file stream", async () => {
    const path = join(root, "clip.mp4");
    writeFileSync(path, "video");
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const response = await createMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1"),
      async () => new Response(stream),
    );

    await response.body?.cancel("preview-closed");

    expect(cancel).toHaveBeenCalledWith("preview-closed");
  });
});
