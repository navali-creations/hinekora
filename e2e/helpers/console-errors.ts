import type { Page } from "@playwright/test";

const expectedMediaAccessErrorPrefix = "Access to video at 'hinekora-media://";
const protocolFailurePairingWindowMs = 250;
const protocolResourceErrors = new Set([
  "Failed to load resource: net::ERR_FAILED",
  "Failed to load resource: net::ERR_UNKNOWN_URL_SCHEME",
]);
const unexpectedConsoleErrorsByPage = new WeakMap<Page, string[]>();

function captureUnexpectedConsoleErrors(page: Page): void {
  const unexpectedErrors: string[] = [];
  const unmatchedProtocolErrors: Array<{ capturedAt: number; text: string }> =
    [];
  const pendingMediaProtocolFailures: number[] = [];
  unexpectedConsoleErrorsByPage.set(page, unexpectedErrors);

  page.on("requestfailed", (request) => {
    if (!request.url().startsWith("hinekora-media://")) {
      return;
    }

    const now = Date.now();
    const matchingErrorIndex = unmatchedProtocolErrors.findLastIndex(
      (error) => now - error.capturedAt <= protocolFailurePairingWindowMs,
    );
    if (matchingErrorIndex >= 0) {
      const [matchingError] = unmatchedProtocolErrors.splice(
        matchingErrorIndex,
        1,
      );
      const unexpectedErrorIndex = unexpectedErrors.lastIndexOf(
        matchingError?.text ?? "",
      );
      if (unexpectedErrorIndex >= 0) {
        unexpectedErrors.splice(unexpectedErrorIndex, 1);
      }
      return;
    }

    pendingMediaProtocolFailures.push(now);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (text.startsWith(expectedMediaAccessErrorPrefix)) {
      return;
    }
    if (protocolResourceErrors.has(text)) {
      const now = Date.now();
      while (
        pendingMediaProtocolFailures.length > 0 &&
        now - (pendingMediaProtocolFailures[0] ?? now) >
          protocolFailurePairingWindowMs
      ) {
        pendingMediaProtocolFailures.shift();
      }
      if (pendingMediaProtocolFailures.length > 0) {
        pendingMediaProtocolFailures.shift();
        return;
      }
    }
    if (protocolResourceErrors.has(text)) {
      unmatchedProtocolErrors.push({ capturedAt: Date.now(), text });
    }
    unexpectedErrors.push(text);
  });
}

function getUnexpectedConsoleErrors(page: Page): string[] {
  return unexpectedConsoleErrorsByPage.get(page) ?? [];
}

export { captureUnexpectedConsoleErrors, getUnexpectedConsoleErrors };
