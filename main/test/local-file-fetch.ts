import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseMediaRange } from "~/main/modules/media-protocol/MediaProtocol.range";

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

  const parsedRange = parseMediaRange(range, data.length);
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

export { fetchLocalFileForTests };
