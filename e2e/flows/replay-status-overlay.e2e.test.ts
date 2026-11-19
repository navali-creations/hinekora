import { expect, type Page, test } from "@playwright/test";

import type { ReplayStatusOverlayEvent } from "~/main/modules/replay-status-overlay/ReplayStatusOverlay.dto";

type ReplayStatusTestWindow = typeof window & {
  __REPLAY_STATUS_TEST__: {
    emit: (status: ReplayStatusOverlayEvent) => void;
    resolveSnapshot: () => void;
    subscribed: boolean;
  };
};

async function openStatusOverlay(
  page: Page,
  initialStatus: ReplayStatusOverlayEvent["status"] = "saving",
  delaySnapshot = false,
) {
  await page.addInitScript(
    ({ initialStatus, delaySnapshot }) => {
      let listener: ((status: ReplayStatusOverlayEvent) => void) | null = null;
      let resolveSnapshot!: () => void;
      const snapshot = new Promise<ReplayStatusOverlayEvent>((resolve) => {
        resolveSnapshot = () =>
          resolve({
            clipId: "manual-1",
            dismissing: false,
            status: initialStatus,
          });
      });
      if (!delaySnapshot) {
        resolveSnapshot();
      }
      const harness: ReplayStatusTestWindow["__REPLAY_STATUS_TEST__"] = {
        emit: (status) => listener?.(status),
        resolveSnapshot,
        subscribed: false,
      };
      Object.defineProperty(window, "electron", {
        value: {
          replayStatusOverlay: {
            getSnapshot: () => snapshot,
            onStatusChanged: (
              callback: (status: ReplayStatusOverlayEvent) => void,
            ) => {
              listener = callback;
              harness.subscribed = true;
              return () => {
                listener = null;
              };
            },
          },
        },
      });
      (window as ReplayStatusTestWindow).__REPLAY_STATUS_TEST__ = harness;
    },
    { initialStatus, delaySnapshot },
  );
  await page.goto("/#/replay-status-overlay?clipId=manual-1");
}

async function emitStatus(
  page: Page,
  status: ReplayStatusOverlayEvent["status"],
) {
  await page.evaluate((status) => {
    (window as ReplayStatusTestWindow).__REPLAY_STATUS_TEST__.emit({
      clipId: "manual-1",
      dismissing: false,
      status,
    });
  }, status);
}

for (const result of ["saved", "failed"] as const) {
  test(`shows saving before the manual replay ${result} result`, async ({
    page,
  }) => {
    await openStatusOverlay(page);
    const notification = page.getByRole("status");
    await expect(notification).toContainText("Saving clip");
    await expect(notification).toHaveAttribute("data-status", "saving");

    if (result === "saved") {
      await emitStatus(page, "processing");
      await expect(notification).toContainText("Processing replay");
    }
    await emitStatus(page, result);
    await expect(notification).toHaveAttribute("data-status", result);
    await expect(notification).toContainText(
      result === "saved" ? "Replay saved" : "Replay save failed",
    );
  });
}

test("recovers a saved status published before the renderer subscribed", async ({
  page,
}) => {
  await openStatusOverlay(page, "saved");
  await expect(page.getByRole("status")).toContainText("Replay saved");
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-status",
    "saved",
  );
});

test("keeps a newer live event when an older snapshot arrives later", async ({
  page,
}) => {
  await openStatusOverlay(page, "saving", true);
  await page.waitForFunction(
    () => (window as ReplayStatusTestWindow).__REPLAY_STATUS_TEST__.subscribed,
  );
  await emitStatus(page, "processing");
  await expect(page.getByRole("status")).toContainText("Processing replay");
  await page.evaluate(async () => {
    (window as ReplayStatusTestWindow).__REPLAY_STATUS_TEST__.resolveSnapshot();
    await Promise.resolve();
  });
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-status",
    "processing",
  );
});
