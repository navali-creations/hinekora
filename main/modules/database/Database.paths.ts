import { join } from "node:path";

const developmentDatabaseFileName = "hinekora.sqlite";
const packagedDatabaseFileName = "hinekora-prod.sqlite";

function resolveMainDatabaseFileName(isPackaged: boolean): string {
  return isPackaged ? packagedDatabaseFileName : developmentDatabaseFileName;
}

function resolveMainDatabasePath(
  userDataPath: string,
  isPackaged: boolean,
): string {
  return join(userDataPath, resolveMainDatabaseFileName(isPackaged));
}

export { resolveMainDatabaseFileName, resolveMainDatabasePath };
