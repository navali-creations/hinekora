import { describe, expect, it } from "vitest";

import {
  createEditorExportOwnershipPolicy,
  hasSameEditorExportIdentity,
} from "../EditorExport.ownership";

const file = {
  deviceId: 10,
  inode: 20,
  modifiedAt: new Date(1_000),
  path: "C:\\Exports\\saved.mp4",
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
          sizeBytes: 30,
        },
        {
          deviceId: 0,
          inode: 0,
          modifiedAtMs: 1_000,
          path: "C:\\Custom\\portable.mp4",
          sizeBytes: 30,
        },
      ],
      ["C:\\Legacy"],
    );

    expect(
      policy.isOwned({ ...file, path: "C:\\Legacy\\historical.mp4" }),
    ).toBe(true);
    expect(policy.isOwned(file)).toBe(true);
    expect(
      policy.isOwned({
        ...file,
        deviceId: 99,
        inode: 99,
        path: "C:\\Custom\\portable.mp4",
      }),
    ).toBe(true);
    expect(policy.isOwned({ ...file, sizeBytes: 31 })).toBe(false);
    expect(policy.isOwned({ ...file, path: "C:\\Custom\\unknown.mp4" })).toBe(
      false,
    );
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

  it("adopts unregistered custom-root exports created before tracking began", () => {
    const compatibility = {
      root: "C:\\Custom",
      trackingStartedAtMs: 2_000,
    };
    const policy = createEditorExportOwnershipPolicy([], [], compatibility);

    expect(
      policy.isOwned({
        ...file,
        modifiedAt: new Date(2_000),
        path: "C:\\Custom\\existing.mp4",
      }),
    ).toBe(true);
    expect(
      policy.isOwned({
        ...file,
        modifiedAt: new Date(2_001),
        path: "C:\\Custom\\new.mp4",
      }),
    ).toBe(false);
    expect(
      policy.isOwned({
        ...file,
        modifiedAt: new Date(1_000),
        path: "C:\\Elsewhere\\existing.mp4",
      }),
    ).toBe(false);
    expect(
      createEditorExportOwnershipPolicy([], [], {
        root: "C:\\Custom",
        trackingStartedAtMs: null,
      }).isOwned({
        ...file,
        path: "C:\\Custom\\existing.mp4",
      }),
    ).toBe(false);
  });
});
