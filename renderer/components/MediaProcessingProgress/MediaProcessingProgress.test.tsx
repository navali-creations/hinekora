import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MediaProcessingProgress } from "./MediaProcessingProgress";

describe("MediaProcessingProgress", () => {
  it("renders bounded progress with optional processing details", () => {
    const html = renderToStaticMarkup(
      <MediaProcessingProgress
        ariaLabel="Video export progress"
        detail="edited-video.mp4"
        label="Saving video"
        progress={1.4}
        status="Finishing up..."
      />,
    );

    expect(html).toContain("Saving video");
    expect(html).toContain("edited-video.mp4");
    expect(html).toContain("Finishing up...");
    expect(html).toContain("100%");
    expect(html).toContain('aria-label="Video export progress"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('data-testid="media-processing-backdrop"');
    expect(html).toContain("--media-processing-progress:100%");
  });

  it("supports an externally owned processing backdrop", () => {
    const html = renderToStaticMarkup(
      <MediaProcessingProgress
        ariaLabel="Video export progress"
        progress={0.5}
        showBackdrop={false}
      />,
    );

    expect(html).not.toContain('data-testid="media-processing-backdrop"');
    expect(html).not.toContain("Saving video");
  });
});
