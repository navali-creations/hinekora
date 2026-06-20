interface CompleteLineResult {
  textToParse: string;
  partialLine: string;
}

function extractCompleteLogLines(chunk: string): CompleteLineResult {
  if (chunk.length > 0 && !chunk.endsWith("\n")) {
    const lastNewline = chunk.lastIndexOf("\n");
    if (lastNewline === -1) {
      return {
        textToParse: "",
        partialLine: chunk,
      };
    }

    return {
      textToParse: chunk.substring(0, lastNewline + 1),
      partialLine: chunk.substring(lastNewline + 1),
    };
  }

  return {
    textToParse: chunk,
    partialLine: "",
  };
}

export type { CompleteLineResult };
export { extractCompleteLogLines };
