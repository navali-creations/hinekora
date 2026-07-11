const mediaProtocolScheme = "hinekora-media";
const clipPreviewMediaHost = "clip-preview";
const replayClipMediaHost = "replay-clip";
const runRecordingMediaHost = "run-recording";
const maxMediaIdLength = 128;

type MediaKind = "clip-preview" | "replay-clip" | "run-recording";

interface MediaRequestTarget {
  id: string;
  kind: MediaKind;
}

function createReplayClipMediaUrl(id: string, version?: string | null): string {
  return createMediaUrl(replayClipMediaHost, id, version);
}

function createClipPreviewMediaUrl(
  id: string,
  version?: string | null,
): string {
  return createMediaUrl(clipPreviewMediaHost, id, version);
}

function createRunRecordingMediaUrl(id: string): string {
  return createMediaUrl(runRecordingMediaHost, id);
}

function resolveMediaRequestTarget(url: string): MediaRequestTarget | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== `${mediaProtocolScheme}:`) {
      return null;
    }

    const kind = resolveMediaKind(parsedUrl.hostname);
    if (!kind) {
      return null;
    }
    const id = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));

    return id.length > 0 && id.length <= maxMediaIdLength ? { id, kind } : null;
  } catch {
    return null;
  }
}

function createMediaUrl(
  host: string,
  id: string,
  version?: string | null,
): string {
  const url = `${mediaProtocolScheme}://${host}/${encodeURIComponent(id)}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function resolveMediaKind(host: string): MediaKind | null {
  switch (host) {
    case clipPreviewMediaHost:
      return "clip-preview";
    case replayClipMediaHost:
      return "replay-clip";
    case runRecordingMediaHost:
      return "run-recording";
    default:
      return null;
  }
}

export type { MediaKind, MediaRequestTarget };
export {
  createClipPreviewMediaUrl,
  createReplayClipMediaUrl,
  createRunRecordingMediaUrl,
  mediaProtocolScheme,
  resolveMediaRequestTarget,
};
