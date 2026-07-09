import { rm } from "node:fs/promises";

import * as FileClipboard from "~/main/utils/file-clipboard";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

interface RenderedFileClipboardResult {
  error: string | null;
  ok: boolean;
}

interface CopyRenderedFileToClipboardInput {
  cleanup: (outputPath: string) => Promise<void>;
  createOutputPath: () => Promise<string>;
  onCleanupError?: (error: unknown, outputPath: string) => void;
  onCopyFailed?: (
    result: RenderedFileClipboardResult,
    outputPath: string,
  ) => void;
  onCopySucceeded?: (outputPath: string) => void;
  onRenderReady?: (outputPath: string) => void;
  onRenderFailed?: (error: unknown, outputPath: string) => void;
  render: (outputPath: string) => Promise<void>;
}

async function copyRenderedFileToClipboard({
  cleanup,
  createOutputPath,
  onCleanupError,
  onCopyFailed,
  onCopySucceeded,
  onRenderFailed,
  onRenderReady,
  render,
}: CopyRenderedFileToClipboardInput): Promise<RenderedFileClipboardResult> {
  let outputPath: string | null = null;

  try {
    outputPath = await createOutputPath();
    const renderedOutputPath = outputPath;
    onRenderReady?.(renderedOutputPath);
    await render(renderedOutputPath);

    const result = await FileClipboard.copyFileToClipboard(renderedOutputPath);
    if (!result.ok) {
      onCopyFailed?.(result, renderedOutputPath);
      await removeRenderedOutput(renderedOutputPath);
      return result;
    }

    onCopySucceeded?.(renderedOutputPath);
    await cleanup(renderedOutputPath).catch((error: unknown) => {
      onCleanupError?.(error, renderedOutputPath);
    });

    return result;
  } catch (error) {
    if (outputPath) {
      onRenderFailed?.(error, outputPath);
      await removeRenderedOutput(outputPath);
    }

    return { ok: false, error: safeErrorMessage(error) };
  }
}

async function removeRenderedOutput(outputPath: string): Promise<void> {
  await rm(outputPath, { force: true }).catch(() => undefined);
}

export {
  type CopyRenderedFileToClipboardInput,
  copyRenderedFileToClipboard,
  type RenderedFileClipboardResult,
};
