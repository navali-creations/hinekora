import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initUmami,
  resetUmamiForTests,
  trackEvent,
  trackPageView,
} from "./umami";

describe("umami", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_UMAMI_ID", "website-id");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    resetUmamiForTests();
    document.head.replaceChildren();
    delete window.umami;
  });

  it("injects the Umami script once when enabled and configured", () => {
    initUmami();
    initUmami();

    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe("https://analytics.hinekora.app/script.js");
    expect(scripts[0]?.defer).toBe(true);
    expect(scripts[0]?.getAttribute("data-website-id")).toBe("website-id");
    expect(scripts[0]?.getAttribute("data-auto-track")).toBe("false");
  });

  it("skips script injection when disabled or not configured", () => {
    initUmami(false);

    expect(document.head.querySelectorAll("script")).toHaveLength(0);
    expect(console.info).toHaveBeenCalledWith(
      "[Umami] Usage analytics disabled by user preference",
    );

    resetUmamiForTests();
    vi.stubEnv("VITE_UMAMI_ID", "");
    initUmami();

    expect(document.head.querySelectorAll("script")).toHaveLength(0);
    expect(console.info).toHaveBeenCalledWith(
      "Umami tracking disabled: VITE_UMAMI_ID not set",
    );
  });

  it("tracks normalized page views when Umami is available", () => {
    const track = vi.fn();
    window.umami = {
      identify: vi.fn(),
      track,
    };
    document.title = "Hinekora";

    trackPageView("/clips/90f010aa-7d3d-4d2b-b512-c98ddc1136ac");

    expect(track).toHaveBeenCalledWith(expect.any(Function));
    expect(track.mock.calls[0]?.[0]({ referrer: "/dashboard" })).toEqual({
      hostname: "hinekora.app",
      referrer: "/dashboard",
      title: "Hinekora",
      url: "/clips/:id",
    });
  });

  it("tracks named events when Umami is available", () => {
    const track = vi.fn();
    window.umami = {
      identify: vi.fn(),
      track,
    };

    trackEvent("clip_saved", { source: "manual" });

    expect(track).toHaveBeenCalledWith("clip_saved", {
      hostname: "hinekora.app",
      source: "manual",
    });
  });

  it("treats tracking as a no-op until Umami is available", () => {
    expect(() => trackPageView("/dashboard")).not.toThrow();
    expect(() => trackEvent("clip_saved")).not.toThrow();
  });
});
