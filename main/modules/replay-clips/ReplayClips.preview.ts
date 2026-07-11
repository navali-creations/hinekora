import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { app } from "electron";

import { createSafePathLogFields, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import { renderReplayClipQuickTrim } from "./ReplayClips.render";

interface PrepareReplayClipPreviewInput {
  clipId: string;
  durationSeconds: number;
  onProgress?: (progress: number) => void;
  sourcePath: string;
  version: string;
}

interface ReplayClipPreviewEntry {
  fingerprint: string;
  path: string;
}

const previewDirectoryName = "hinekora-clip-previews";
const maxCachedPreviews = 8;
type RemovePreviewFile = (path: string) => Promise<void>;

class ReplayClipPreviewService {
  private readonly entries = new Map<string, ReplayClipPreviewEntry>();
  private readonly pending = new Map<string, Promise<string | null>>();
  private initializedDirectory: Promise<string> | null = null;

  constructor(
    private readonly removePreviewFile: RemovePreviewFile = async (path) => {
      await rm(path, { force: true });
    },
  ) {}

  getPath(clipId: string): string | null {
    return this.entries.get(clipId)?.path ?? null;
  }

  async prepare(input: PrepareReplayClipPreviewInput): Promise<string | null> {
    const fingerprint = createPreviewFingerprint(input);
    const cached = this.entries.get(input.clipId);
    if (cached?.fingerprint === fingerprint) {
      return cached.path;
    }

    const previous = this.pending.get(input.clipId) ?? Promise.resolve(null);
    const preparation = previous.then(() =>
      this.renderPreview(input, fingerprint),
    );
    this.pending.set(input.clipId, preparation);
    try {
      return await preparation;
    } finally {
      if (this.pending.get(input.clipId) === preparation) {
        this.pending.delete(input.clipId);
      }
    }
  }

  async remove(clipId: string): Promise<void> {
    const entry = this.entries.get(clipId);
    this.entries.delete(clipId);
    if (entry) {
      await this.removeFile(entry.path);
    }
  }

  private async renderPreview(
    input: PrepareReplayClipPreviewInput,
    fingerprint: string,
  ): Promise<string | null> {
    let stagedPath: string | null = null;
    try {
      const directory = await this.getPreviewDirectory();
      const outputPath = join(directory, `${fingerprint}.mp4`);
      stagedPath = join(
        directory,
        `${fingerprint}.partial-${randomUUID()}.mp4`,
      );
      await renderReplayClipQuickTrim({
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
        outputPath: stagedPath,
        queuePolicy: "preview",
        resolution: "720p",
        sourcePath: input.sourcePath,
        trim: { inSeconds: 0, outSeconds: input.durationSeconds },
      });
      await rename(stagedPath, outputPath);
      const previous = this.entries.get(input.clipId);
      this.entries.delete(input.clipId);
      this.entries.set(input.clipId, { fingerprint, path: outputPath });
      if (previous && previous.path !== outputPath) {
        await this.removeFile(previous.path);
      }
      await this.evictOldPreviews();
      return outputPath;
    } catch (error) {
      if (stagedPath) {
        await this.removeFile(stagedPath);
      }
      logWarn("replay-clips", "Replay preview proxy preparation failed", {
        clipId: input.clipId,
        error: safeErrorMessage(error),
        ...createSafePathLogFields(input.sourcePath, "source"),
      });
      return null;
    }
  }

  private async getPreviewDirectory(): Promise<string> {
    if (!this.initializedDirectory) {
      this.initializedDirectory = this.initializePreviewDirectory();
    }
    const initialization = this.initializedDirectory;
    try {
      return await initialization;
    } catch (error) {
      this.initializedDirectory = null;
      throw error;
    }
  }

  private async removeFile(path: string): Promise<void> {
    try {
      await this.removePreviewFile(path);
    } catch {
      // Preview cleanup is best effort and must not break clip playback.
    }
  }

  private async initializePreviewDirectory(): Promise<string> {
    const directory = join(app.getPath("temp"), previewDirectoryName);
    await mkdir(directory, { recursive: true });
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map((entry) => this.removeFile(join(directory, entry.name))),
    );
    return directory;
  }

  private async evictOldPreviews(): Promise<void> {
    while (this.entries.size > maxCachedPreviews) {
      const oldestClipId = this.entries.keys().next().value as string;
      await this.remove(oldestClipId);
    }
  }
}

function createPreviewFingerprint(
  input: PrepareReplayClipPreviewInput,
): string {
  return createHash("sha256")
    .update(
      `${input.clipId}\0${input.sourcePath}\0${input.durationSeconds}\0${input.version}`,
    )
    .digest("hex")
    .slice(0, 24);
}

export { ReplayClipPreviewService };
