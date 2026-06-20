const UMAMI_SCRIPT_URL = "https://analytics.hinekora.app/script.js";
const APP_HOSTNAME = "hinekora.app";
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

declare global {
  interface Window {
    umami?: {
      track: {
        (eventName: string, data?: Record<string, unknown>): void;
        (
          callback: (props: Record<string, unknown>) => Record<string, unknown>,
        ): void;
      };
      identify: (sessionId?: string, data?: Record<string, unknown>) => void;
    };
  }
}

let initialized = false;

function normalizeUrl(url: string): string {
  return url.replace(UUID_PATTERN, ":id");
}

function initUmami(enabled = true): void {
  if (!enabled) {
    console.info("[Umami] Usage analytics disabled by user preference");
    return;
  }

  if (initialized) {
    return;
  }

  const websiteId = import.meta.env.VITE_UMAMI_ID;
  if (!websiteId) {
    console.info("Umami tracking disabled: VITE_UMAMI_ID not set");
    return;
  }

  const script = document.createElement("script");
  script.src = UMAMI_SCRIPT_URL;
  script.defer = true;
  script.setAttribute("data-website-id", websiteId);
  script.setAttribute("data-auto-track", "false");
  document.head.appendChild(script);

  initialized = true;
}

function trackPageView(url: string, title?: string): void {
  if (!window.umami) {
    return;
  }

  window.umami.track((props) => ({
    ...props,
    hostname: APP_HOSTNAME,
    title: title ?? document.title,
    url: normalizeUrl(url),
  }));
}

function trackEvent(eventName: string, data?: Record<string, unknown>): void {
  if (!window.umami) {
    return;
  }

  window.umami.track(eventName, { ...data, hostname: APP_HOSTNAME });
}

function resetUmamiForTests(): void {
  initialized = false;
}

export { initUmami, resetUmamiForTests, trackEvent, trackPageView };
