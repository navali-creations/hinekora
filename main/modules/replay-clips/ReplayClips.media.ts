import { createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import { Readable } from "node:stream";

const HINEKORA_MEDIA_SCHEME = "hinekora-media";
const REPLAY_CLIP_MEDIA_HOST = "replay-clip";
const RUN_RECORDING_MEDIA_HOST = "run-recording";
const mediaCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

type HinekoraMediaKind = "replay-clip" | "run-recording";

interface HinekoraMediaRequestTarget {
  id: string;
  kind: HinekoraMediaKind;
}

interface MediaByteRange {
  start: number;
  end: number;
}

export function createReplayClipMediaUrl(id: string): string {
  return createHinekoraMediaUrl(REPLAY_CLIP_MEDIA_HOST, id);
}

export function createRunRecordingMediaUrl(id: string): string {
  return createHinekoraMediaUrl(RUN_RECORDING_MEDIA_HOST, id);
}

export function resolveHinekoraMediaRequestTarget(
  url: string,
): HinekoraMediaRequestTarget | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== `${HINEKORA_MEDIA_SCHEME}:`) {
      return null;
    }

    const kind = resolveMediaKind(parsedUrl.hostname);
    if (!kind) {
      return null;
    }

    const id = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));

    return id.length > 0 && id.length <= 2048 ? { id, kind } : null;
  } catch {
    return null;
  }
}

export function resolveReplayClipMediaRequestId(url: string): string | null {
  const target = resolveHinekoraMediaRequestTarget(url);

  return target?.kind === "replay-clip" && target.id.length <= 128
    ? target.id
    : null;
}

export function createReplayClipMediaFileResponse(
  clipPath: string,
  request: Request,
): Response {
  const stats = statSync(clipPath);
  if (!stats.isFile() || stats.size <= 0) {
    return new Response(null, { status: 404 });
  }

  const fileSize = stats.size;
  const rangeHeader = request.headers.get("range");
  const contentType = resolveMediaContentType(clipPath);
  const bodyAllowed = request.method.toUpperCase() !== "HEAD";

  if (rangeHeader) {
    const range = parseMediaRange(rangeHeader, fileSize);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          ...mediaCorsHeaders,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${fileSize}`,
        },
      });
    }

    const contentLength = range.end - range.start + 1;

    return new Response(
      bodyAllowed ? createMediaFileBody(clipPath, range) : null,
      {
        status: 206,
        headers: {
          ...mediaCorsHeaders,
          "Accept-Ranges": "bytes",
          "Content-Length": String(contentLength),
          "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
          "Content-Type": contentType,
        },
      },
    );
  }

  return new Response(bodyAllowed ? createMediaFileBody(clipPath) : null, {
    status: 200,
    headers: {
      ...mediaCorsHeaders,
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
    },
  });
}

function createMediaFileBody(
  clipPath: string,
  range?: MediaByteRange,
): BodyInit {
  return Readable.toWeb(
    createReadStream(clipPath, range),
  ) as unknown as BodyInit;
}

function parseMediaRange(
  rangeHeader: string,
  fileSize: number,
): MediaByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const startText = match[1] as string;
  const endText = match[2] as string;
  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : fileSize - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

function resolveMediaContentType(clipPath: string): string {
  switch (extname(clipPath).toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}

function createHinekoraMediaUrl(host: string, id: string): string {
  return `${HINEKORA_MEDIA_SCHEME}://${host}/${encodeURIComponent(id)}`;
}

function resolveMediaKind(host: string): HinekoraMediaKind | null {
  switch (host) {
    case REPLAY_CLIP_MEDIA_HOST:
      return "replay-clip";
    case RUN_RECORDING_MEDIA_HOST:
      return "run-recording";
    default:
      return null;
  }
}
