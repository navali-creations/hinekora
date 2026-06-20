import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createReplayClipMediaFileResponse,
  createReplayClipMediaUrl,
  createRunRecordingMediaUrl,
  resolveHinekoraMediaRequestTarget,
  resolveReplayClipMediaRequestId,
} from "../ReplayClips.media";

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
        `hinekora-media://run-recording/${"x".repeat(2049)}`,
      ),
    ).toBe(null);
    expect(
      resolveHinekoraMediaRequestTarget("hinekora-media://other/item"),
    ).toBe(null);
  });

  it("resolves replay media clip ids from safe protocol URLs", () => {
    expect(
      resolveReplayClipMediaRequestId("hinekora-media://replay-clip/clip-1"),
    ).toBe("clip-1");
    expect(
      resolveReplayClipMediaRequestId(
        "hinekora-media://replay-clip/clip%20one",
      ),
    ).toBe("clip one");
    expect(resolveReplayClipMediaRequestId("https://example.test/clip-1")).toBe(
      null,
    );
    expect(
      resolveReplayClipMediaRequestId("hinekora-media://other/clip-1"),
    ).toBe(null);
    expect(
      resolveReplayClipMediaRequestId("hinekora-media://replay-clip/"),
    ).toBe(null);
    expect(
      resolveReplayClipMediaRequestId(
        `hinekora-media://replay-clip/${"x".repeat(129)}`,
      ),
    ).toBe(null);
    expect(resolveReplayClipMediaRequestId("not a url")).toBe(null);
  });

  it("serves media responses for full, head, and byte-range requests", async () => {
    const path = join(root, "clip.mp4");
    writeFileSync(path, "abcdef");

    const fullResponse = createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1"),
    );
    expect(fullResponse.status).toBe(200);
    expect(fullResponse.headers.get("Accept-Ranges")).toBe("bytes");
    expect(fullResponse.headers.get("Content-Length")).toBe("6");
    expect(fullResponse.headers.get("Content-Type")).toBe("video/mp4");
    await expect(fullResponse.text()).resolves.toBe("abcdef");

    const headResponse = createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", { method: "HEAD" }),
    );
    expect(headResponse.status).toBe(200);
    expect(headResponse.body).toBeNull();

    const rangeResponse = createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=1-3" },
      }),
    );
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get("Content-Length")).toBe("3");
    expect(rangeResponse.headers.get("Content-Range")).toBe("bytes 1-3/6");
    await expect(rangeResponse.text()).resolves.toBe("bcd");

    const suffixResponse = createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=-2" },
      }),
    );
    expect(suffixResponse.status).toBe(206);
    expect(suffixResponse.headers.get("Content-Range")).toBe("bytes 4-5/6");
    await expect(suffixResponse.text()).resolves.toBe("ef");

    const openEndedResponse = createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=3-" },
      }),
    );
    expect(openEndedResponse.status).toBe(206);
    expect(openEndedResponse.headers.get("Content-Range")).toBe("bytes 3-5/6");
    await expect(openEndedResponse.text()).resolves.toBe("def");

    const clippedEndResponse = createReplayClipMediaFileResponse(
      path,
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=2-99" },
      }),
    );
    expect(clippedEndResponse.status).toBe(206);
    expect(clippedEndResponse.headers.get("Content-Range")).toBe("bytes 2-5/6");
    await expect(clippedEndResponse.text()).resolves.toBe("cdef");
  });

  it("rejects empty, directory, and invalid range media requests", () => {
    const emptyPath = join(root, "empty.mp4");
    const directoryPath = join(root, "directory.mp4");
    const path = join(root, "clip.mp4");
    writeFileSync(emptyPath, "");
    mkdirSync(directoryPath);
    writeFileSync(path, "abcdef");

    expect(
      createReplayClipMediaFileResponse(
        emptyPath,
        new Request("hinekora-media://replay-clip/clip-1"),
      ).status,
    ).toBe(404);
    expect(
      createReplayClipMediaFileResponse(
        directoryPath,
        new Request("hinekora-media://replay-clip/clip-1"),
      ).status,
    ).toBe(404);

    for (const range of [
      "items=1-2",
      "bytes=-",
      "bytes=-0",
      "bytes=5-4",
      "bytes=6-",
    ]) {
      const response = createReplayClipMediaFileResponse(
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

  it("maps known media extensions to browser content types", () => {
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
        createReplayClipMediaFileResponse(
          path,
          new Request("hinekora-media://replay-clip/clip-1", {
            method: "HEAD",
          }),
        ).headers.get("Content-Type"),
      ).toBe(contentType);
    }
  });
});
