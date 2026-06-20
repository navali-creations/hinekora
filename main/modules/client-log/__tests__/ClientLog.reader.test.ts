import { describe, expect, it } from "vitest";

import { extractCompleteLogLines } from "../ClientLog.reader";

describe("extractCompleteLogLines", () => {
  it("keeps an incomplete trailing line for the next append", () => {
    expect(extractCompleteLogLines("line 1\nline 2")).toEqual({
      textToParse: "line 1\n",
      partialLine: "line 2",
    });
  });

  it("returns no parse text when the append has no complete lines", () => {
    expect(extractCompleteLogLines("partial")).toEqual({
      textToParse: "",
      partialLine: "partial",
    });
  });

  it("parses all lines when the append ends with a newline", () => {
    expect(extractCompleteLogLines("line 1\nline 2\n")).toEqual({
      textToParse: "line 1\nline 2\n",
      partialLine: "",
    });
  });
});
