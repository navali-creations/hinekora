interface MediaByteRange {
  end: number;
  start: number;
}

function parseMediaRange(
  rangeHeader: string,
  fileSize: number,
): MediaByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const startText = match[1]!;
  const endText = match[2]!;
  if (!startText && !endText) {
    return null;
  }
  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : fileSize - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }

  return { start, end: Math.min(end, fileSize - 1) };
}

export type { MediaByteRange };
export { parseMediaRange };
