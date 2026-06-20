export function createClipPreviewMediaUrl(clipId: string): string {
  return `hinekora-media://replay-clip/${encodeURIComponent(clipId)}`;
}

export function resolveClipPreviewRouteClipId(hash: string): string | null {
  const [, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  const clipId = params.get("clipId");

  return clipId && clipId.length > 0 ? clipId : null;
}
