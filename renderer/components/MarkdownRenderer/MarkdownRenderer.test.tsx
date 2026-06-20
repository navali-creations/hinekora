import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders raw HTML as text instead of HTML nodes", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer>{'<img src=x onerror="alert(1)">'}</MarkdownRenderer>,
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });
});
