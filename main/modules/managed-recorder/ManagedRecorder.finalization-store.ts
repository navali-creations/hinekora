import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

import type { RunRecordingCreateInput } from "~/main/modules/recording-storage";

import { GameIdSchema } from "~/types";

const pendingRunRecordingFinalizationFileName =
  "pending-run-recording-finalization.json";
const maxPendingRunRecordingFinalizationFileBytes = 256 * 1_024;

const RunRecordingFinalizationInputSchema = z
  .object({
    framesPerSecond: z.number().positive().max(240).nullable(),
    path: z.string().min(1).max(32_767),
    sourceGame: GameIdSchema,
    sourceLeague: z.string().min(1).max(80),
    startedAt: z.string().datetime(),
    stoppedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    ({ startedAt, stoppedAt }) =>
      Date.parse(stoppedAt) >= Date.parse(startedAt),
    {
      message: "Recording stop time must not precede its start time",
      path: ["stoppedAt"],
    },
  );

const PendingRunRecordingFinalizationSchema = z
  .object({
    input: RunRecordingFinalizationInputSchema,
    version: z.literal(1),
  })
  .strict();

interface PendingRunRecordingFinalizationFileSystem {
  mkdirSync(path: string, options: { recursive: true }): unknown;
  readFileSync(path: string, encoding: "utf8"): string;
  renameSync(oldPath: string, newPath: string): void;
  rmSync(path: string, options: { force: true }): void;
  statSync(path: string): { size: number };
  writeFileSync(path: string, data: string, encoding: "utf8"): void;
}

const nodeFileSystem: PendingRunRecordingFinalizationFileSystem = {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
};

class PendingRunRecordingFinalizationStore {
  private readonly temporaryPath: string;

  constructor(
    private readonly path: string,
    private readonly fileSystem: PendingRunRecordingFinalizationFileSystem = nodeFileSystem,
  ) {
    this.temporaryPath = `${path}.tmp`;
  }

  load(): RunRecordingCreateInput | null {
    try {
      const fileSizeBytes = this.fileSystem.statSync(this.path).size;
      if (fileSizeBytes > maxPendingRunRecordingFinalizationFileBytes) {
        throw new Error("Run recording finalization recovery is too large");
      }
      const contents = this.fileSystem.readFileSync(this.path, "utf8");
      return PendingRunRecordingFinalizationSchema.parse(JSON.parse(contents))
        .input;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }

  isValid(input: RunRecordingCreateInput): boolean {
    return RunRecordingFinalizationInputSchema.safeParse(input).success;
  }

  save(input: RunRecordingCreateInput): void {
    const contents = JSON.stringify(
      PendingRunRecordingFinalizationSchema.parse({ input, version: 1 }),
    );
    this.fileSystem.mkdirSync(dirname(this.path), { recursive: true });

    try {
      this.fileSystem.writeFileSync(this.temporaryPath, contents, "utf8");
      this.fileSystem.renameSync(this.temporaryPath, this.path);
    } catch (error) {
      this.clearTemporaryFile();
      throw error;
    }
  }

  clear(): void {
    try {
      this.fileSystem.rmSync(this.path, { force: true });
    } finally {
      this.clearTemporaryFile();
    }
  }

  private clearTemporaryFile(): void {
    try {
      this.fileSystem.rmSync(this.temporaryPath, { force: true });
    } catch {
      // Temporary cleanup must never hide a durable read, write, or clear error.
    }
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export type { PendingRunRecordingFinalizationFileSystem };
export {
  PendingRunRecordingFinalizationStore,
  pendingRunRecordingFinalizationFileName,
};
