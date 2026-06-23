import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  normalizeMediaDurationSeconds,
  readMp4DurationSeconds,
} from "./media-metadata";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hinekora-media-metadata-"));
});

afterEach(() => {
  rmSync(directory, { force: true, recursive: true });
});

describe("media metadata", () => {
  it("reads version 0 MP4 movie header durations", () => {
    const path = join(directory, "recording.mp4");
    writeFileSync(
      path,
      Buffer.concat([
        createMp4Box("ftyp", Buffer.from("isom")),
        createMp4Box("mdat", Buffer.from("skip")),
        createMp4Box("moov", createMp4Box("mvhd", createMovieHeaderV0(78_250))),
      ]),
    );

    expect(readMp4DurationSeconds(path)).toBe(78.25);
  });

  it("reads version 1 MP4 movie header durations", () => {
    const path = join(directory, "recording-v1.mp4");
    writeFileSync(
      path,
      createMp4Box("moov", createMp4Box("mvhd", createMovieHeaderV1(125_500n))),
    );

    expect(readMp4DurationSeconds(path)).toBe(125.5);
  });

  it("skips empty top-level MP4 boxes before movie metadata", () => {
    const path = join(directory, "obs-recording.mp4");
    writeFileSync(
      path,
      Buffer.concat([
        createMp4Box("ftyp", Buffer.from("isom")),
        createMp4Box("free", Buffer.alloc(0)),
        createMp4Box("mdat", Buffer.from("skip")),
        createMp4Box("moov", createMp4Box("mvhd", createMovieHeaderV0(78_250))),
      ]),
    );

    expect(readMp4DurationSeconds(path)).toBe(78.25);
  });

  it("returns null for unavailable or unsupported media duration", () => {
    const path = join(directory, "invalid.mp4");
    writeFileSync(path, "not an mp4");
    const moovWithoutMovieHeaderPath = join(directory, "moov-no-mvhd.mp4");
    writeFileSync(
      moovWithoutMovieHeaderPath,
      createMp4Box("moov", createMp4Box("free", Buffer.from("skip"))),
    );
    const shortMovieHeaderPath = join(directory, "short-mvhd.mp4");
    writeFileSync(
      shortMovieHeaderPath,
      createMp4Box("moov", createMp4Box("mvhd", Buffer.alloc(4))),
    );
    const shortVersionOnePath = join(directory, "short-v1-mvhd.mp4");
    const shortVersionOne = Buffer.alloc(20);
    shortVersionOne.writeUInt8(1, 0);
    writeFileSync(
      shortVersionOnePath,
      createMp4Box("moov", createMp4Box("mvhd", shortVersionOne)),
    );
    const hugeVersionOnePath = join(directory, "huge-v1-mvhd.mp4");
    const hugeVersionOne = Buffer.alloc(32);
    hugeVersionOne.writeUInt8(1, 0);
    hugeVersionOne.writeUInt32BE(1_000, 20);
    hugeVersionOne.writeBigUInt64BE(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 24);
    writeFileSync(
      hugeVersionOnePath,
      createMp4Box("moov", createMp4Box("mvhd", hugeVersionOne)),
    );
    const unsupportedVersionPath = join(directory, "unsupported-mvhd.mp4");
    const unsupportedVersion = Buffer.alloc(20);
    unsupportedVersion.writeUInt8(2, 0);
    writeFileSync(
      unsupportedVersionPath,
      createMp4Box("moov", createMp4Box("mvhd", unsupportedVersion)),
    );
    const zeroTimescalePath = join(directory, "zero-timescale.mp4");
    const zeroTimescale = createMovieHeaderV0(10_000);
    zeroTimescale.writeUInt32BE(0, 12);
    writeFileSync(
      zeroTimescalePath,
      createMp4Box("moov", createMp4Box("mvhd", zeroTimescale)),
    );

    expect(readMp4DurationSeconds(path)).toBeNull();
    expect(readMp4DurationSeconds(join(directory, "missing.mp4"))).toBeNull();
    expect(readMp4DurationSeconds(moovWithoutMovieHeaderPath)).toBeNull();
    expect(readMp4DurationSeconds(shortMovieHeaderPath)).toBeNull();
    expect(readMp4DurationSeconds(shortVersionOnePath)).toBeNull();
    expect(readMp4DurationSeconds(hugeVersionOnePath)).toBeNull();
    expect(readMp4DurationSeconds(unsupportedVersionPath)).toBeNull();
    expect(readMp4DurationSeconds(zeroTimescalePath)).toBeNull();
    expect(normalizeMediaDurationSeconds(0)).toBeNull();
    expect(normalizeMediaDurationSeconds(Number.NaN)).toBeNull();
    expect(normalizeMediaDurationSeconds(1.2345)).toBe(1.235);
  });

  it("handles size-zero and oversized MP4 boxes", () => {
    const sizeZeroPath = join(directory, "size-zero.mp4");
    writeFileSync(
      sizeZeroPath,
      createMp4SizeZeroBox(
        "moov",
        createMp4Box("mvhd", createMovieHeaderV0(3_000)),
      ),
    );
    const largeBoxPath = join(directory, "large-box.mp4");
    writeFileSync(
      largeBoxPath,
      createMp4LargeBox(
        "moov",
        createMp4Box("mvhd", createMovieHeaderV0(4_500)),
      ),
    );
    const oversizedPath = join(directory, "oversized.mp4");
    writeFileSync(oversizedPath, createMp4LargeBoxHeader("moov"));
    const shortHeaderPath = join(directory, "short-header.mp4");
    writeFileSync(shortHeaderPath, Buffer.alloc(4));
    const shortLargeHeaderPath = join(directory, "short-large-header.mp4");
    writeFileSync(shortLargeHeaderPath, createShortLargeBoxHeader("moov"));

    expect(readMp4DurationSeconds(sizeZeroPath)).toBe(3);
    expect(readMp4DurationSeconds(largeBoxPath)).toBe(4.5);
    expect(readMp4DurationSeconds(oversizedPath)).toBeNull();
    expect(readMp4DurationSeconds(shortHeaderPath)).toBeNull();
    expect(readMp4DurationSeconds(shortLargeHeaderPath)).toBeNull();
  });
});

function createMp4Box(type: string, payload: Buffer): Buffer {
  const box = Buffer.alloc(8 + payload.length);
  box.writeUInt32BE(box.length, 0);
  box.write(type, 4, 4, "ascii");
  payload.copy(box, 8);

  return box;
}

function createMp4SizeZeroBox(type: string, payload: Buffer): Buffer {
  const box = Buffer.alloc(8 + payload.length);
  box.writeUInt32BE(0, 0);
  box.write(type, 4, 4, "ascii");
  payload.copy(box, 8);

  return box;
}

function createMp4LargeBoxHeader(type: string): Buffer {
  const box = Buffer.alloc(16);
  box.writeUInt32BE(1, 0);
  box.write(type, 4, 4, "ascii");
  box.writeBigUInt64BE(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 8);

  return box;
}

function createMp4LargeBox(type: string, payload: Buffer): Buffer {
  const box = Buffer.alloc(16 + payload.length);
  box.writeUInt32BE(1, 0);
  box.write(type, 4, 4, "ascii");
  box.writeBigUInt64BE(BigInt(box.length), 8);
  payload.copy(box, 16);

  return box;
}

function createShortLargeBoxHeader(type: string): Buffer {
  const box = Buffer.alloc(8);
  box.writeUInt32BE(1, 0);
  box.write(type, 4, 4, "ascii");

  return box;
}

function createMovieHeaderV0(duration: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(1_000, 12);
  payload.writeUInt32BE(duration, 16);

  return payload;
}

function createMovieHeaderV1(duration: bigint): Buffer {
  const payload = Buffer.alloc(32);
  payload.writeUInt8(1, 0);
  payload.writeUInt32BE(1_000, 20);
  payload.writeBigUInt64BE(duration, 24);

  return payload;
}
