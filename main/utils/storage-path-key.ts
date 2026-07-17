import { normalize, resolve } from "node:path";

import { isWindowsOS } from "./platform";

function createStoragePathKey(path: string): string {
  const normalizedPath = normalize(resolve(path));

  return isWindowsOS() ? normalizedPath.toLowerCase() : normalizedPath;
}

export { createStoragePathKey };
