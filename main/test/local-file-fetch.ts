import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

function fetchLocalFileForTests(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const method = init.method?.toUpperCase() ?? "GET";
  const path = fileURLToPath(url);
  let data: Buffer;
  try {
    const stats = statSync(path);
    if (!stats.isFile() || stats.size <= 0) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    data = readFileSync(path);
  } catch {
    return Promise.resolve(new Response(null, { status: 404 }));
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Length": String(data.length),
  });
  const range = new Headers(init.headers).get("range");
  if (!range) {
    return Promise.resolve(
      new Response(method === "HEAD" ? null : Uint8Array.from(data).buffer, {
        headers,
        status: 200,
      }),
    );
  }

  const parsedRange = parseRange(range, data.length);
  if (!parsedRange) {
    headers.set("Content-Range", `bytes */${data.length}`);
    return Promise.resolve(new Response(null, { headers, status: 416 }));
  }

  const body = data.subarray(parsedRange.start, parsedRange.end + 1);
  headers.set("Content-Length", String(body.length));
  headers.set(
    "Content-Range",
    `bytes ${parsedRange.start}-${parsedRange.end}/${data.length}`,
  );
  return Promise.resolve(
    new Response(method === "HEAD" ? null : Uint8Array.from(body).buffer, {
      headers,
      status: 206,
    }),
  );
}

function parseRange(
  header: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
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
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export { fetchLocalFileForTests };
