import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const HINEKORA_MEDIA_SCHEME = "hinekora-media";
const REPLAY_CLIP_MEDIA_HOST = "replay-clip";
const RUN_RECORDING_MEDIA_HOST = "run-recording";
const MAX_MEDIA_ID_LENGTH = 128;

type HinekoraMediaKind = "replay-clip" | "run-recording";

interface HinekoraMediaRequestTarget {
  id: string;
  kind: HinekoraMediaKind;
}

interface MediaByteRange {
  end: number;
  start: number;
}

type MediaFileFetcher = (url: string, init: RequestInit) => Promise<Response>;

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

    return id.length > 0 && id.length <= MAX_MEDIA_ID_LENGTH
      ? { id, kind }
      : null;
  } catch {
    return null;
  }
}

export async function createReplayClipMediaFileResponse(
  clipPath: string,
  request: Request,
  fetchFile: MediaFileFetcher,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const corsOrigin = resolveMediaCorsOrigin(request.headers.get("origin"));
  if (corsOrigin === false) {
    return new Response(null, { status: 403 });
  }

  const fileSize = await resolveMediaFileSize(clipPath);
  if (fileSize === null) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseMediaRange(rangeHeader, fileSize) : null;
  if (rangeHeader && !range) {
    const responseHeaders = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${fileSize}`,
    });
    applyMediaCorsHeaders(responseHeaders, corsOrigin);
    return new Response(null, { headers: responseHeaders, status: 416 });
  }
  if (rangeHeader) {
    headers.set("Range", rangeHeader);
  }
  const fileResponse = await fetchFile(pathToFileURL(clipPath).toString(), {
    method,
    headers,
  });
  // Electron applies file byte ranges but reports them as headerless 200s.
  const responseHeaders = new Headers(fileResponse.headers);
  responseHeaders.set("Accept-Ranges", "bytes");
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", resolveMediaContentType(clipPath));
  }
  if (range) {
    responseHeaders.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${fileSize}`,
    );
    responseHeaders.set("Content-Length", String(range.end - range.start + 1));
  } else {
    responseHeaders.set("Content-Length", String(fileSize));
  }
  applyMediaCorsHeaders(responseHeaders, corsOrigin);

  return new Response(method === "HEAD" ? null : fileResponse.body, {
    status: range && fileResponse.status < 400 ? 206 : fileResponse.status,
    headers: responseHeaders,
  });
}

async function resolveMediaFileSize(clipPath: string): Promise<number | null> {
  try {
    const stats = await stat(clipPath);
    return stats.isFile() && stats.size > 0 ? stats.size : null;
  } catch {
    return null;
  }
}

function parseMediaRange(
  rangeHeader: string,
  fileSize: number,
): MediaByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
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

  return { start, end: Math.min(end, fileSize - 1) };
}

function applyMediaCorsHeaders(
  headers: Headers,
  corsOrigin: string | null,
): void {
  if (!corsOrigin) {
    return;
  }

  headers.set("Access-Control-Allow-Origin", corsOrigin);
  headers.set("Vary", "Origin");
}

function resolveMediaCorsOrigin(origin: string | null): string | false | null {
  if (!origin) {
    return null;
  }
  if (origin === "null" || origin === "file://") {
    return origin;
  }

  try {
    const parsedOrigin = new URL(origin);
    const isLocalDevelopmentOrigin =
      (parsedOrigin.protocol === "http:" ||
        parsedOrigin.protocol === "https:") &&
      (parsedOrigin.hostname === "localhost" ||
        parsedOrigin.hostname === "127.0.0.1" ||
        parsedOrigin.hostname === "[::1]");

    return isLocalDevelopmentOrigin ? parsedOrigin.origin : false;
  } catch {
    return false;
  }
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
