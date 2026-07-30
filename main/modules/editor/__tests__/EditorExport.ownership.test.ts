import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createEditorExportOwnershipPolicy,
  hasSameEditorExportIdentity,
} from "../EditorExport.ownership";

const testRoot = resolve("test-editor-export-ownership");
const exportsRoot = join(testRoot, "exports");
const legacyRoot = join(testRoot, "legacy");
const customRoot = join(testRoot, "custom");
const file = {
  deviceId: 10,
  inode: 20,
  modifiedAt: new Date(1_000),
  path: join(exportsRoot, "saved.mp4"),
  sizeBytes: 30,
};

describe("editor export ownership", () => {
  it("trusts dedicated roots and matching registered export identities", () => {
    const policy = createEditorExportOwnershipPolicy(
      [
        {
          deviceId: 10,
          inode: 20,
          modifiedAtMs: 1_000,
          path: file.path,
          projectId: "project-1",
          sizeBytes: 30,
        },
        {
          deviceId: 0,
          inode: 0,
          modifiedAtMs: 1_000,
          path: join(customRoot, "portable.mp4"),
          projectId: null,
          sizeBytes: 30,
        },
      ],
      [legacyRoot],
    );

    expect(
      policy.isOwned({ ...file, path: join(legacyRoot, "historical.mp4") }),
    ).toBe(true);
    expect(policy.isOwned(file)).toBe(true);
    expect(policy.getRegistration(file)?.projectId).toBe("project-1");
    expect(
      policy.getRegistration({
        ...file,
        path: join(legacyRoot, "historical.mp4"),
      }),
    ).toBeNull();
    expect(
      policy.isOwned({
        ...file,
        deviceId: 99,
        inode: 99,
        path: join(customRoot, "portable.mp4"),
      }),
    ).toBe(true);
    expect(policy.isOwned({ ...file, sizeBytes: 31 })).toBe(false);
    expect(
      policy.isOwned({ ...file, path: join(customRoot, "unknown.mp4") }),
    ).toBe(false);
  });

  it("keeps registered files and implicit roots owned", () => {
    const policy = createEditorExportOwnershipPolicy(
      [
        {
          deviceId: 10,
          inode: 20,
          modifiedAtMs: 1_000,
          path: file.path,
          projectId: null,
          sizeBytes: 30,
        },
      ],
      [legacyRoot],
    );

    expect(policy.isOwned(file)).toBe(true);
    expect(
      policy.isOwned({ ...file, path: join(legacyRoot, "historical.mp4") }),
    ).toBe(true);
  });

  it("rejects files replaced between inventory and deletion", () => {
    expect(
      hasSameEditorExportIdentity(file, {
        dev: 11,
        ino: 20,
        mtimeMs: 1_000,
        size: 30,
      }),
    ).toBe(false);
    expect(
      hasSameEditorExportIdentity(file, {
        dev: 10,
        ino: 21,
        mtimeMs: 1_000,
        size: 30,
      }),
    ).toBe(false);
    expect(
      hasSameEditorExportIdentity(file, {
        dev: 10,
        ino: 20,
        mtimeMs: 1_000,
        size: 31,
      }),
    ).toBe(false);
    expect(
      hasSameEditorExportIdentity(file, {
        dev: 10,
        ino: 20,
        mtimeMs: 1_010,
        size: 30,
      }),
    ).toBe(false);
    expect(hasSameEditorExportIdentity(file, { size: 30 })).toBe(true);
  });

  it("does not adopt unregistered custom-root videos", () => {
    const policy = createEditorExportOwnershipPolicy([], []);

    expect(
      policy.isOwned({
        ...file,
        path: join(customRoot, "existing.mp4"),
      }),
    ).toBe(false);
  });
});
