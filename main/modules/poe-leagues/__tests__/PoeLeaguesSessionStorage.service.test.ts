import { afterEach, describe, expect, it, vi } from "vitest";

import { EncryptedPoeLeaguesSessionStorage } from "../PoeLeaguesSessionStorage.service";

const appLogMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "C:\\test",
  },
  safeStorage: {
    decryptString: (buffer: Buffer) =>
      buffer.toString("utf8").replace(/^encrypted:/u, ""),
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, "utf8"),
    isEncryptionAvailable: () => true,
  },
}));
vi.mock("~/main/utils/app-log", () => appLogMocks);

interface EncryptedStorageHarnessOptions {
  decryptString?: (buffer: Buffer) => string;
  nodeEnv?: string;
  platform?: NodeJS.Platform;
  safeStorageAvailable?: boolean;
}

function createEncryptedStorageHarness(
  initialFile: Buffer | string | null = null,
  options: EncryptedStorageHarnessOptions = {},
) {
  let sessionFile = initialFile;
  let temporaryFile: Buffer | string | null = null;
  const sessionPath = "C:\\test\\poe-leagues-supabase-session.enc";
  const temporaryPath = `${sessionPath}.tmp`;
  const fileSystem = {
    chmodSync: vi.fn<(path: string, mode: number) => void>(),
    existsSync: vi.fn<(path: string) => boolean>((path) =>
      path === temporaryPath ? temporaryFile !== null : sessionFile !== null,
    ),
    readFileSync: vi.fn<(path: string) => Buffer>(() => {
      if (Buffer.isBuffer(sessionFile)) {
        return sessionFile;
      }

      return Buffer.from(sessionFile ?? "", "utf8");
    }),
    renameSync: vi.fn<(oldPath: string, newPath: string) => void>(
      (oldPath, newPath) => {
        if (oldPath !== temporaryPath || newPath !== sessionPath) {
          throw new Error("Unexpected session rename");
        }
        sessionFile = temporaryFile;
        temporaryFile = null;
      },
    ),
    statSync: vi.fn<(path: string) => { size: number }>(() => ({
      size: Buffer.isBuffer(sessionFile)
        ? sessionFile.byteLength
        : Buffer.byteLength(sessionFile ?? "", "utf8"),
    })),
    unlinkSync: vi.fn<(path: string) => void>((path) => {
      if (path === temporaryPath) {
        temporaryFile = null;
      } else {
        sessionFile = null;
      }
    }),
    writeFileSync: vi.fn<
      (path: string, data: Buffer | string, encoding?: BufferEncoding) => void
    >((path, data) => {
      if (path === temporaryPath) {
        temporaryFile = data;
      } else {
        sessionFile = data;
      }
    }),
  };
  const safeStorage = {
    decryptString: vi.fn<(buffer: Buffer) => string>(
      options.decryptString ??
        ((buffer) => buffer.toString("utf8").replace(/^encrypted:/u, "")),
    ),
    encryptString: vi.fn<(value: string) => Buffer>((value) =>
      Buffer.from(`encrypted:${value}`, "utf8"),
    ),
    isEncryptionAvailable: vi.fn<() => boolean>(
      () => options.safeStorageAvailable ?? true,
    ),
  };
  const storage = new EncryptedPoeLeaguesSessionStorage({
    fileSystem,
    nodeEnv: options.nodeEnv ?? "production",
    platform: options.platform ?? "linux",
    safeStorage,
    sessionPath,
  });

  return {
    fileSystem,
    getSessionFile: () => sessionFile,
    safeStorage,
    sessionPath,
    storage,
  };
}

describe("EncryptedPoeLeaguesSessionStorage", () => {
  afterEach(() => {
    appLogMocks.logWarn.mockReset();
  });

  it("encrypts and loads a persisted Supabase session", () => {
    const { fileSystem, getSessionFile, safeStorage, sessionPath, storage } =
      createEncryptedStorageHarness();
    const session = {
      refresh_token: "refresh-token",
      user_id: "user-id",
    };

    storage.save(session);

    expect(safeStorage.encryptString).toHaveBeenCalledWith(
      JSON.stringify(session),
    );
    expect(Buffer.isBuffer(getSessionFile())).toBe(true);
    expect(fileSystem.chmodSync).toHaveBeenCalledWith(
      `${sessionPath}.tmp`,
      0o600,
    );
    expect(storage.load()).toEqual(session);
    expect(storage.loadUserIds()).toEqual(["user-id"]);
    expect(safeStorage.decryptString).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("archives rejected identities without retaining their refresh tokens", () => {
    const { getSessionFile, storage } = createEncryptedStorageHarness();
    storage.save({
      refresh_token: "rejected-refresh-token",
      user_id: "rejected-user-id",
    });

    storage.clearSession("rejected-user-id");

    expect(storage.load()).toBeNull();
    expect(storage.loadUserIds()).toEqual(["rejected-user-id"]);
    expect(String(getSessionFile())).not.toContain("rejected-refresh-token");
  });

  it("carries a bounded identity history into the next session", () => {
    const { storage } = createEncryptedStorageHarness(
      Buffer.from(
        `encrypted:${JSON.stringify({
          previous_user_ids: ["user-1", "user-2", "user-3", "user-4", "user-5"],
        })}`,
        "utf8",
      ),
    );

    storage.save({
      refresh_token: "current-refresh-token",
      user_id: "current-user-id",
    });

    expect(storage.load()).toEqual({
      refresh_token: "current-refresh-token",
      user_id: "current-user-id",
    });
    expect(storage.loadUserIds()).toEqual([
      "current-user-id",
      "user-1",
      "user-2",
      "user-3",
      "user-4",
      "user-5",
    ]);
  });

  it("archives a replaced session once and keeps only five previous IDs", () => {
    const { storage } = createEncryptedStorageHarness(
      Buffer.from(
        `encrypted:${JSON.stringify({
          previous_user_ids: [
            "previous-user-id",
            "previous-user-id",
            "user-3",
            "user-4",
            "user-5",
          ],
          refresh_token: "old-refresh-token",
          user_id: "old-user-id",
        })}`,
        "utf8",
      ),
    );

    storage.save({
      refresh_token: "new-refresh-token",
      user_id: "new-user-id",
    });

    expect(storage.loadUserIds()).toEqual([
      "new-user-id",
      "old-user-id",
      "previous-user-id",
      "user-3",
      "user-4",
      "user-5",
    ]);
  });

  it("clears an empty identity history by deleting the session file", () => {
    const { fileSystem, storage } = createEncryptedStorageHarness();

    storage.clearSession(null);

    expect(fileSystem.writeFileSync).not.toHaveBeenCalled();
  });

  it("preserves the previous session when an atomic rename fails", () => {
    const previousSession = {
      refresh_token: "previous-refresh-token",
      user_id: "previous-user-id",
    };
    const { fileSystem, storage } = createEncryptedStorageHarness(
      Buffer.from(`encrypted:${JSON.stringify(previousSession)}`, "utf8"),
    );
    fileSystem.renameSync.mockImplementationOnce(() => {
      throw new Error("rename failed");
    });

    storage.save({
      refresh_token: "next-refresh-token",
      user_id: "next-user-id",
    });

    expect(storage.load()).toEqual(previousSession);
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence failed",
      { operation: "save", reason: "rename failed" },
    );
  });

  it("loads legacy sessions without retaining their access token", () => {
    const { storage } = createEncryptedStorageHarness(
      Buffer.from(
        `encrypted:${JSON.stringify({
          access_token: "legacy-access-token",
          refresh_token: "refresh-token",
          user_id: "user-id",
        })}`,
        "utf8",
      ),
    );

    expect(storage.load()).toEqual({
      refresh_token: "refresh-token",
      user_id: "user-id",
    });
  });

  it.each([Number.NaN, -1, 32 * 1024 + 1])(
    "deletes persisted sessions with an invalid file size (%s)",
    (size) => {
      const { fileSystem, sessionPath, storage } =
        createEncryptedStorageHarness(Buffer.from("encrypted:{}", "utf8"));
      fileSystem.statSync.mockReturnValue({ size });

      expect(storage.load()).toBeNull();
      expect(fileSystem.readFileSync).not.toHaveBeenCalled();
      expect(fileSystem.unlinkSync).toHaveBeenCalledWith(sessionPath);
    },
  );

  it("rechecks persisted session size after reading", () => {
    const { fileSystem, sessionPath, storage } = createEncryptedStorageHarness(
      Buffer.alloc(32 * 1024 + 1),
    );
    fileSystem.statSync.mockReturnValue({ size: 1 });

    expect(storage.load()).toBeNull();
    expect(fileSystem.readFileSync).toHaveBeenCalled();
    expect(fileSystem.unlinkSync).toHaveBeenCalledWith(sessionPath);
  });

  it("rejects an oversized decrypted session payload", () => {
    const { fileSystem, sessionPath, storage } = createEncryptedStorageHarness(
      Buffer.from("encrypted:small", "utf8"),
      { decryptString: () => "x".repeat(32 * 1024 + 1) },
    );

    expect(storage.load()).toBeNull();
    expect(fileSystem.unlinkSync).toHaveBeenCalledWith(sessionPath);
  });

  it("returns null when no persisted session exists", () => {
    const { fileSystem, storage } = createEncryptedStorageHarness();

    expect(storage.load()).toBeNull();
    expect(storage.loadUserIds()).toEqual([]);
    storage.delete();

    expect(fileSystem.readFileSync).not.toHaveBeenCalled();
    expect(fileSystem.unlinkSync).not.toHaveBeenCalled();
  });

  it("ignores invalid session saves", () => {
    const { fileSystem, storage } = createEncryptedStorageHarness();

    storage.save({
      refresh_token: "",
      user_id: "user-id",
    });

    expect(fileSystem.writeFileSync).not.toHaveBeenCalled();
  });

  it("uses plaintext session files in development when encryption is unavailable", () => {
    const { fileSystem, getSessionFile, safeStorage, storage } =
      createEncryptedStorageHarness(null, {
        nodeEnv: "development",
        safeStorageAvailable: false,
      });
    const session = {
      refresh_token: "refresh-token",
      user_id: "user-id",
    };

    storage.save(session);

    expect(safeStorage.encryptString).not.toHaveBeenCalled();
    expect(fileSystem.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(session),
      "utf8",
    );
    expect(getSessionFile()).toBe(JSON.stringify(session));
    expect(storage.load()).toEqual(session);
  });

  it("loads plaintext development sessions when encrypted reads fail", () => {
    const session = {
      refresh_token: "refresh-token",
      user_id: "user-id",
    };
    const { safeStorage, storage } = createEncryptedStorageHarness(
      JSON.stringify(session),
      {
        decryptString: () => {
          throw new Error("not encrypted");
        },
        nodeEnv: "development",
      },
    );

    expect(storage.load()).toEqual(session);
    expect(safeStorage.decryptString).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("deletes production sessions that cannot be decrypted", () => {
    const { fileSystem, storage, sessionPath } = createEncryptedStorageHarness(
      Buffer.from("plaintext", "utf8"),
      {
        decryptString: () => {
          throw new Error("not encrypted");
        },
      },
    );

    expect(storage.load()).toBeNull();

    expect(fileSystem.unlinkSync).toHaveBeenCalledWith(sessionPath);
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence failed",
      {
        operation: "load",
        reason: "Stored Supabase session could not be decrypted",
      },
    );
  });

  it("does not chmod encrypted session files on Windows", () => {
    const { fileSystem, storage } = createEncryptedStorageHarness(null, {
      platform: "win32",
    });

    storage.save({
      refresh_token: "refresh-token",
      user_id: "user-id",
    });

    expect(fileSystem.writeFileSync).toHaveBeenCalled();
    expect(fileSystem.chmodSync).not.toHaveBeenCalled();
  });

  it("logs and skips production session saves when safeStorage is unavailable", () => {
    const { fileSystem, safeStorage, storage } =
      createEncryptedStorageHarness();

    safeStorage.isEncryptionAvailable.mockReturnValue(false);
    storage.save({
      refresh_token: "refresh-token",
      user_id: "user-id",
    });

    expect(fileSystem.writeFileSync).not.toHaveBeenCalled();
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence unavailable",
      {
        operation: "save",
        reason: "safeStorage-unavailable",
      },
    );
  });

  it("logs unavailable production session persistence once", () => {
    const { safeStorage, storage } = createEncryptedStorageHarness();

    safeStorage.isEncryptionAvailable.mockReturnValue(false);
    storage.save({
      refresh_token: "refresh-token",
      user_id: "user-id",
    });
    storage.save({
      refresh_token: "refresh-token",
      user_id: "user-id",
    });

    expect(appLogMocks.logWarn).toHaveBeenCalledTimes(1);
  });

  it("logs encrypted session write failures without throwing", () => {
    const { fileSystem, storage } = createEncryptedStorageHarness();

    fileSystem.writeFileSync.mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    storage.save({
      refresh_token: "refresh-token",
      user_id: "user-id",
    });

    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence failed",
      {
        operation: "save",
        reason: "disk full",
      },
    );
  });

  it("logs encrypted session delete failures without throwing", () => {
    const { fileSystem, storage } = createEncryptedStorageHarness(
      Buffer.from("encrypted:{}", "utf8"),
    );

    fileSystem.unlinkSync.mockImplementationOnce(() => {
      throw new Error("locked");
    });
    storage.delete();

    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence failed",
      {
        operation: "delete",
        reason: "locked",
      },
    );
  });

  it("logs and ignores stored production sessions when safeStorage is unavailable", () => {
    const { fileSystem, safeStorage, storage } = createEncryptedStorageHarness(
      Buffer.from("encrypted:{}", "utf8"),
    );

    safeStorage.isEncryptionAvailable.mockReturnValue(false);

    expect(storage.load()).toBeNull();
    expect(fileSystem.unlinkSync).not.toHaveBeenCalled();
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence unavailable",
      {
        operation: "load",
        reason: "safeStorage-unavailable",
      },
    );
  });

  it("deletes a corrupted persisted Supabase session", () => {
    const { fileSystem, storage, sessionPath } = createEncryptedStorageHarness(
      Buffer.from("encrypted:{not-json", "utf8"),
    );

    expect(storage.load()).toBeNull();

    expect(fileSystem.unlinkSync).toHaveBeenCalledWith(sessionPath);
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence failed",
      {
        operation: "load",
        reason: expect.any(String),
      },
    );
  });

  it("deletes persisted Supabase sessions with invalid envelopes", () => {
    const { fileSystem, storage, sessionPath } = createEncryptedStorageHarness(
      Buffer.from(
        `encrypted:${JSON.stringify({
          access_token: "",
          refresh_token: "refresh-token",
          user_id: "user-id",
        })}`,
        "utf8",
      ),
    );

    expect(storage.load()).toBeNull();

    expect(fileSystem.unlinkSync).toHaveBeenCalledWith(sessionPath);
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "poe-leagues",
      "Supabase session persistence failed",
      {
        operation: "load",
        reason: "Stored Supabase session is invalid",
      },
    );
  });
});
