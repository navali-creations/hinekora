import { normalize, resolve } from "node:path";

function createStoragePathKey(path: string): string {
  return normalize(resolve(path)).toLowerCase();
}

export { createStoragePathKey };
