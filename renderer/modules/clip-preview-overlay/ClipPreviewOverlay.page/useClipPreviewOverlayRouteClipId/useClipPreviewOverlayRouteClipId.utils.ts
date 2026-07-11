function resolveClipPreviewRouteClipId(hash: string): string | null {
  const [, query = ""] = hash.split("?");
  const clipId = new URLSearchParams(query).get("clipId");

  return clipId && clipId.length > 0 ? clipId : null;
}

export { resolveClipPreviewRouteClipId };
