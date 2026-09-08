import type { WebContents } from "electron";

function isCurrentRendererDocument(
  webContents: Pick<WebContents, "getURL">,
  targetUrl: string,
): boolean {
  return targetUrl === webContents.getURL();
}

function isExpectedRendererLoadInterruption(
  errorCode: number,
  errorDescription: string,
): boolean {
  return errorCode === -3 || errorDescription === "ERR_ABORTED";
}

export { isCurrentRendererDocument, isExpectedRendererLoadInterruption };
