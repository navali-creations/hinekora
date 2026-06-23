import { closeSync, fstatSync, openSync, readSync } from "node:fs";

interface Mp4BoxHeader {
  contentOffset: number;
  endOffset: number;
  size: number;
  type: string;
}

const boxHeaderSize = 8;
const largeBoxHeaderSize = 16;
const maxBoxesToScan = 10_000;

function readMp4DurationSeconds(path: string): number | null {
  let fileDescriptor: number | null = null;

  try {
    fileDescriptor = openSync(path, "r");
    const fileSize = fstatSync(fileDescriptor).size;
    const durationSeconds = findMp4MovieHeaderDuration(
      fileDescriptor,
      0,
      fileSize,
    );

    return normalizeMediaDurationSeconds(durationSeconds);
  } catch {
    return null;
  } finally {
    if (fileDescriptor !== null) {
      closeSync(fileDescriptor);
    }
  }
}

function findMp4MovieHeaderDuration(
  fileDescriptor: number,
  startOffset: number,
  endOffset: number,
): number | null {
  let offset = startOffset;
  let scannedBoxes = 0;

  while (offset + boxHeaderSize <= endOffset && scannedBoxes < maxBoxesToScan) {
    scannedBoxes += 1;
    const header = readMp4BoxHeader(fileDescriptor, offset, endOffset);
    if (!header) {
      return null;
    }

    if (header.type === "mvhd") {
      return readMp4MovieHeaderDuration(fileDescriptor, header);
    }

    if (header.type === "moov") {
      const durationSeconds = findMp4MovieHeaderDuration(
        fileDescriptor,
        header.contentOffset,
        header.endOffset,
      );
      if (durationSeconds !== null) {
        return durationSeconds;
      }
    }

    offset = header.endOffset;
  }

  return null;
}

function readMp4BoxHeader(
  fileDescriptor: number,
  offset: number,
  parentEndOffset: number,
): Mp4BoxHeader | null {
  const header = Buffer.alloc(largeBoxHeaderSize);
  /* v8 ignore next -- The scanner checks that a full box header is in bounds. */
  if (!readExactly(fileDescriptor, header, boxHeaderSize, offset)) {
    return null;
  }

  const smallSize = header.readUInt32BE(0);
  const type = header.subarray(4, 8).toString("ascii");
  let size = smallSize;
  let contentOffset = offset + boxHeaderSize;

  if (smallSize === 1) {
    if (!readExactly(fileDescriptor, header, largeBoxHeaderSize, offset)) {
      return null;
    }

    const largeSize = header.readBigUInt64BE(8);
    if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    size = Number(largeSize);
    contentOffset = offset + largeBoxHeaderSize;
  } else if (smallSize === 0) {
    size = parentEndOffset - offset;
  }

  const endOffset = offset + size;
  if (
    size < contentOffset - offset ||
    endOffset < contentOffset ||
    endOffset > parentEndOffset
  ) {
    return null;
  }

  return {
    contentOffset,
    endOffset,
    size,
    type,
  };
}

function readMp4MovieHeaderDuration(
  fileDescriptor: number,
  header: Mp4BoxHeader,
): number | null {
  const buffer = Buffer.alloc(32);
  const bytesToRead = Math.min(
    buffer.length,
    header.endOffset - header.contentOffset,
  );
  if (bytesToRead < 20) {
    return null;
  }

  /* v8 ignore next -- Parent box bounds are derived from the real file size. */
  if (!readExactly(fileDescriptor, buffer, bytesToRead, header.contentOffset)) {
    return null;
  }

  const version = buffer.readUInt8(0);
  if (version === 1) {
    if (bytesToRead < 32) {
      return null;
    }

    const timescale = buffer.readUInt32BE(20);
    const duration = buffer.readBigUInt64BE(24);
    if (duration > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    return divideMediaDuration(Number(duration), timescale);
  }

  if (version !== 0) {
    return null;
  }

  const timescale = buffer.readUInt32BE(12);
  const duration = buffer.readUInt32BE(16);

  return divideMediaDuration(duration, timescale);
}

function divideMediaDuration(
  duration: number,
  timescale: number,
): number | null {
  if (timescale <= 0) {
    return null;
  }

  return duration / timescale;
}

function normalizeMediaDurationSeconds(
  durationSeconds: number | null,
): number | null {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  return Math.round(durationSeconds * 1_000) / 1_000;
}

function readExactly(
  fileDescriptor: number,
  buffer: Buffer,
  length: number,
  position: number,
): boolean {
  return readSync(fileDescriptor, buffer, 0, length, position) === length;
}

export { normalizeMediaDurationSeconds, readMp4DurationSeconds };
