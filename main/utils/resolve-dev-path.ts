import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const maxWalkDepth = 5;

function resolveDevFile(startPath: string, filePath: string): string {
  const direct = join(startPath, filePath);
  if (existsSync(direct)) {
    return direct;
  }

  let candidate = startPath;
  for (let index = 0; index < maxWalkDepth; index += 1) {
    const parent = resolve(candidate, "..");
    if (parent === candidate) {
      break;
    }

    candidate = parent;
    const attempt = join(candidate, filePath);
    if (existsSync(attempt)) {
      return attempt;
    }
  }

  return direct;
}

export { resolveDevFile };
