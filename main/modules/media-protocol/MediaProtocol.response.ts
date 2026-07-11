import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

import { parseMediaRange } from "./MediaProtocol.range";

type MediaFileFetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function createMediaFileResponse(
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
      "Cache-Control": "no-store",
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
  responseHeaders.set("Cache-Control", "no-store");
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
