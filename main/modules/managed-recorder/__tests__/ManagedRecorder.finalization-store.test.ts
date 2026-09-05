import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RunRecordingCreateInput } from "~/main/modules/recording-storage";

import {
  type PendingRunRecordingFinalizationFileSystem,
  PendingRunRecordingFinalizationStore,
} from "../ManagedRecorder.finalization-store";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hinekora-finalization-store-"));
});

afterEach(() => {
  rmSync(directory, { force: true, recursive: true });
});

function createInput(): RunRecordingCreateInput {
  return {
    framesPerSecond: 60,
    path: "C:\\Recordings\\run.mp4",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    startedAt: "2026-09-05T10:00:00.000Z",
    stoppedAt: "2026-09-05T11:00:00.000Z",
  };
}

describe("PendingRunRecordingFinalizationStore", () => {
  it("atomically saves, loads, and clears finalization metadata", () => {
    const path = join(directory, "recovery", "pending.json");
    const store = new PendingRunRecordingFinalizationStore(path);

    expect(store.isValid(createInput())).toBe(true);
    expect(store.load()).toBeNull();

    store.save(createInput());

    expect(store.load()).toEqual(createInput());
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      input: createInput(),
      version: 1,
    });

    store.clear();
    expect(store.load()).toBeNull();
  });

  it("rejects malformed or untrusted recovery metadata", () => {
    const path = join(directory, "pending.json");
    const store = new PendingRunRecordingFinalizationStore(path);
    writeFileSync(
      path,
      JSON.stringify({
        input: { ...createInput(), sourceGame: "not-a-game" },
        version: 1,
      }),
      "utf8",
    );

    expect(() => store.load()).toThrow();
    expect(
      store.isValid({ ...createInput(), sourceGame: "not-a-game" } as never),
    ).toBe(false);
    expect(() =>
      store.save({ ...createInput(), sourceGame: "not-a-game" } as never),
    ).toThrow();
  });

  it.each([
    {
      sourceLeague: "x".repeat(81),
    },
    {
      startedAt: "2026-09-05T12:00:00.000Z",
      stoppedAt: "2026-09-05T11:00:00.000Z",
    },
  ])("rejects recovery metadata outside domain invariants", (overrides) => {
    const path = join(directory, "pending.json");
    const store = new PendingRunRecordingFinalizationStore(path);
    writeFileSync(
      path,
      JSON.stringify({
        input: { ...createInput(), ...overrides },
        version: 1,
      }),
      "utf8",
    );

    expect(() => store.load()).toThrow();
    expect(store.isValid({ ...createInput(), ...overrides })).toBe(false);
    expect(() => store.save({ ...createInput(), ...overrides })).toThrow();
  });

  it("rejects oversized recovery metadata before reading it", () => {
    const fileSystem = {
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      renameSync: vi.fn(),
      rmSync: vi.fn(),
      statSync: vi.fn(() => ({ size: 256 * 1_024 + 1 })),
      writeFileSync: vi.fn(),
    } satisfies PendingRunRecordingFinalizationFileSystem;
    const store = new PendingRunRecordingFinalizationStore(
      join(directory, "pending.json"),
      fileSystem,
    );

    expect(() => store.load()).toThrow(
      "Run recording finalization recovery is too large",
    );
    expect(fileSystem.readFileSync).not.toHaveBeenCalled();
  });

  it("removes the temporary file when an atomic rename fails", () => {
    const renameError = new Error("rename failed");
    const fileSystem = {
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      renameSync: vi.fn(() => {
        throw renameError;
      }),
      rmSync: vi.fn(),
      statSync: vi.fn(() => ({ size: 0 })),
      writeFileSync: vi.fn(),
    } satisfies PendingRunRecordingFinalizationFileSystem;
    const path = join(directory, "pending.json");
    const store = new PendingRunRecordingFinalizationStore(path, fileSystem);

    expect(() => store.save(createInput())).toThrow(renameError);
    expect(fileSystem.rmSync).toHaveBeenCalledWith(`${path}.tmp`, {
      force: true,
    });
  });

  it("preserves the atomic write error when temporary cleanup also fails", () => {
    const renameError = new Error("rename failed");
    const fileSystem = {
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      renameSync: vi.fn(() => {
        throw renameError;
      }),
      rmSync: vi.fn(() => {
        throw new Error("temporary cleanup failed");
      }),
      statSync: vi.fn(() => ({ size: 0 })),
      writeFileSync: vi.fn(),
    } satisfies PendingRunRecordingFinalizationFileSystem;
    const store = new PendingRunRecordingFinalizationStore(
      join(directory, "pending.json"),
      fileSystem,
    );

    expect(() => store.save(createInput())).toThrow(renameError);
  });

  it("ignores temporary cleanup failures after durable metadata is cleared", () => {
    const path = join(directory, "pending.json");
    const fileSystem = {
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      renameSync: vi.fn(),
      rmSync: vi.fn((target) => {
        if (target === `${path}.tmp`) {
          throw new Error("temporary cleanup failed");
        }
      }),
      statSync: vi.fn(() => ({ size: 0 })),
      writeFileSync: vi.fn(),
    } satisfies PendingRunRecordingFinalizationFileSystem;
    const store = new PendingRunRecordingFinalizationStore(path, fileSystem);

    expect(() => store.clear()).not.toThrow();
    expect(fileSystem.rmSync).toHaveBeenNthCalledWith(1, path, { force: true });
    expect(fileSystem.rmSync).toHaveBeenNthCalledWith(2, `${path}.tmp`, {
      force: true,
    });
  });

  it("preserves durable clear errors while still attempting temporary cleanup", () => {
    const clearError = new Error("durable clear failed");
    const path = join(directory, "pending.json");
    const fileSystem = {
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      renameSync: vi.fn(),
      rmSync: vi.fn((target) => {
        if (target === path) {
          throw clearError;
        }
      }),
      statSync: vi.fn(() => ({ size: 0 })),
      writeFileSync: vi.fn(),
    } satisfies PendingRunRecordingFinalizationFileSystem;
    const store = new PendingRunRecordingFinalizationStore(path, fileSystem);

    expect(() => store.clear()).toThrow(clearError);
    expect(fileSystem.rmSync).toHaveBeenCalledWith(`${path}.tmp`, {
      force: true,
    });
  });
});
