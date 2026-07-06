import { existsSync } from "node:fs";
import { join } from "node:path";

type PathExists = (path: string) => boolean;

const HELPER_PATH_ENV_VAR = "HINEKORA_POE_PROCESS_HELPER_PATH";
const HELPER_RESOURCE_DIR = "poe-process-helper";
const WINDOWS_HELPER_EXECUTABLE_NAME = "hinekora-poe-process-helper.exe";

interface ResolveWindowsPoeProcessHelperPathOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  isPackaged?: boolean;
  pathExists?: PathExists;
  resourcesPath?: string | null;
}

function resolveWindowsPoeProcessHelperPath(
  options: ResolveWindowsPoeProcessHelperPathOptions = {},
): string | null {
  const pathExists = options.pathExists ?? existsSync;
  const env = options.env ?? process.env;
  const developmentPathsAllowed = options.isPackaged !== true;
  const candidates: string[] = [];
  const configuredPath = env[HELPER_PATH_ENV_VAR]?.trim();
  if (configuredPath && developmentPathsAllowed) {
    candidates.push(configuredPath);
  }

  const resourcesPath =
    options.resourcesPath === undefined
      ? resolveProcessResourcesPath()
      : options.resourcesPath;
  if (resourcesPath) {
    candidates.push(
      join(resourcesPath, HELPER_RESOURCE_DIR, WINDOWS_HELPER_EXECUTABLE_NAME),
    );
  }

  if (developmentPathsAllowed) {
    const cwd = options.cwd ?? process.cwd();
    candidates.push(
      join(
        cwd,
        "helpers",
        "bin",
        HELPER_RESOURCE_DIR,
        WINDOWS_HELPER_EXECUTABLE_NAME,
      ),
      join(
        cwd,
        "helpers",
        "poe-process-helper",
        "target",
        "release",
        WINDOWS_HELPER_EXECUTABLE_NAME,
      ),
      join(
        cwd,
        "helpers",
        "poe-process-helper",
        "target",
        "debug",
        WINDOWS_HELPER_EXECUTABLE_NAME,
      ),
    );
  }

  return candidates.find((candidate) => pathExists(candidate)) ?? null;
}

function resolveProcessResourcesPath(): string | null {
  const resourcesPath = Reflect.get(process, "resourcesPath");

  return typeof resourcesPath === "string" && resourcesPath.length > 0
    ? resourcesPath
    : null;
}

export type { PathExists, ResolveWindowsPoeProcessHelperPathOptions };
export {
  HELPER_RESOURCE_DIR,
  resolveWindowsPoeProcessHelperPath,
  WINDOWS_HELPER_EXECUTABLE_NAME,
};
