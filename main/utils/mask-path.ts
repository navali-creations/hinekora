export function maskPath(fullPath: string, anchors: string[]): string {
  if (!fullPath || anchors.length === 0) {
    return fullPath;
  }

  const normalized = fullPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const separator = fullPath.includes("\\") ? "\\" : "/";
  const root = parts[0];
  const lowerAnchors = anchors.map((anchor) => anchor.toLowerCase());

  let anchorIndex = -1;
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index];
    if (part && lowerAnchors.includes(part.toLowerCase())) {
      anchorIndex = index;
      break;
    }
  }

  if (anchorIndex > 1) {
    return [root, "**", ...parts.slice(anchorIndex)].join(separator);
  }

  if (anchorIndex === 1) {
    return fullPath;
  }

  if (parts.length > 3) {
    return [root, "**", ...parts.slice(-2)].join(separator);
  }

  return fullPath;
}
