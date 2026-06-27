import { expect, type Page } from "@playwright/test";

import type {
  CropRegionSelection,
  SelectCropRegionOptions,
} from "../../main/modules/overlay-windows/OverlayWindows.dto";
import {
  type AppSettings,
  type CapturePreviewSource,
  createDefaultSettings,
  type Profile,
  type ProfileUpdateInput,
} from "../../types";
import {
  type E2EBridgeDomainFactory,
  e2eBridgeDomainFactorySource,
} from "./bridge-fixture";

interface AuraOverlayE2ECalls {
  profileUpdates: ProfileUpdateInput[];
  selectCropRegionCalls: SelectCropRegionOptions[];
  settingsReads: number;
  unexpectedBridgeCalls: string[];
}

interface AuraOverlayE2EFixture {
  captureSources: CapturePreviewSource[];
  now: string;
  profile: Profile;
  selection: CropRegionSelection;
  settings: AppSettings;
}

interface AuraOverlayE2EOptions {
  withArchedAura?: boolean;
}

type AuraOverlayE2EElectron = Window["electron"];

const auraOverlayE2ENow = "2026-06-27T00:00:00.000Z";

function createAuraOverlayE2EProfile(options: AuraOverlayE2EOptions): Profile {
  const cropRegions: Profile["cropRegions"] =
    options.withArchedAura === true
      ? [
          {
            arc: {
              controlX: 110,
              controlY: 20,
              endX: 200,
              endY: 160,
              startX: 20,
              startY: 160,
              thickness: 20,
            },
            height: 180,
            id: "crop-arc-1",
            label: "Arched aura 1",
            referenceHeight: 1080,
            referenceWidth: 1920,
            shape: "arc",
            width: 220,
            x: 100,
            y: 120,
          },
        ]
      : [];
  const overlayPlacements: Profile["overlayPlacements"] =
    options.withArchedAura === true
      ? [
          {
            cropRegionId: "crop-arc-1",
            id: "placement-arc-1",
            opacity: 1,
            referenceHeight: 1080,
            referenceWidth: 1920,
            scale: 1,
            x: 850,
            y: 450,
          },
        ]
      : [];

  return {
    captureTarget: {
      height: 1080,
      id: "1",
      kind: "display",
      label: "Screen 1 (Display Model)",
      width: 1920,
    },
    createdAt: auraOverlayE2ENow,
    cropRegions,
    game: "poe2",
    id: "profile-1",
    name: "PoE 2",
    overlayPlacements,
    targetFps: 60,
    updatedAt: auraOverlayE2ENow,
  };
}

function createAuraOverlayE2EFixture(
  options: AuraOverlayE2EOptions = {},
): AuraOverlayE2EFixture {
  return {
    captureSources: [
      {
        displayId: "1",
        height: 1080,
        id: "screen:1:0",
        kind: "screen",
        name: "Screen 1 (Display Model)",
        thumbnailDataUrl: null,
        width: 1920,
      },
    ],
    now: auraOverlayE2ENow,
    profile: createAuraOverlayE2EProfile(options),
    selection: {
      arc: {
        controlX: 110,
        controlY: 20,
        endX: 200,
        endY: 160,
        startX: 20,
        startY: 160,
        thickness: 20,
      },
      height: 180,
      shape: "arc",
      viewportHeight: 1080,
      viewportWidth: 1920,
      width: 220,
      x: 100,
      y: 120,
    },
    settings: {
      ...createDefaultSettings(),
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      installedGames: ["poe2"],
      poe2SelectedLeague: "Runes of Aldur",
      setupCompleted: true,
      setupStep: 3,
      setupVersion: 1,
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: false,
    },
  };
}

async function setupAuraOverlayE2E(
  page: Page,
  options: AuraOverlayE2EOptions = {},
) {
  await page.setViewportSize({ height: 760, width: 1280 });
  await page.addInitScript(
    (input: {
      bridgeFactorySource: string;
      fixture: AuraOverlayE2EFixture;
    }) => {
      const { fixture } = input;
      const unsubscribe = () => undefined;
      const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
      const createBridgeDomainFactory = Function(
        `"use strict"; return (${input.bridgeFactorySource});`,
      )() as E2EBridgeDomainFactory;
      let profile = clone(fixture.profile);
      const calls: AuraOverlayE2ECalls = {
        profileUpdates: [],
        selectCropRegionCalls: [],
        settingsReads: 0,
        unexpectedBridgeCalls: [],
      };
      const listeners: {
        auraAdd?: (request: {
          requestId: string;
          shape?: "rect" | "arc";
        }) => void;
        auraLock?: (locked: boolean) => void;
        profilesChanged?: (profiles: Profile[]) => void;
      } = {};
      const createBridgeDomain = <TBridge extends object>(
        domain: string,
        methods: Partial<TBridge>,
      ): TBridge =>
        createBridgeDomainFactory(
          domain,
          methods,
          calls.unexpectedBridgeCalls,
          "aura overlay",
        );

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => new MediaStream(),
        },
      });
      HTMLMediaElement.prototype.play = async function play() {
        return undefined;
      };

      (
        window as unknown as {
          __HINEKORA_AURA_OVERLAY_E2E__: AuraOverlayE2ECalls;
          electron: unknown;
        }
      ).__HINEKORA_AURA_OVERLAY_E2E__ = calls;

      const electron = {
        capturePreview: createBridgeDomain<
          AuraOverlayE2EElectron["capturePreview"]
        >("capturePreview", {
          getSourceThumbnail: async () => null,
          listSources: async () => clone(fixture.captureSources),
          onRefreshRequested: () => unsubscribe,
          sourceExists: async () => true,
        }),
        overlayWindows: createBridgeDomain<
          AuraOverlayE2EElectron["overlayWindows"]
        >("overlayWindows", {
          isAuraLocked: async () => false,
          onAuraAddRequested: (callback) => {
            listeners.auraAdd = callback;

            return unsubscribe;
          },
          onAuraLockChanged: (callback) => {
            listeners.auraLock = callback;

            return unsubscribe;
          },
          selectCropRegion: async (options) => {
            calls.selectCropRegionCalls.push(clone(options ?? {}));

            return clone(fixture.selection);
          },
          setAuraLocked: async (locked) => {
            listeners.auraLock?.(locked);
          },
        }),
        profiles: createBridgeDomain<AuraOverlayE2EElectron["profiles"]>(
          "profiles",
          {
            list: async () => [clone(profile)],
            onChanged: (callback) => {
              listeners.profilesChanged = callback;

              return unsubscribe;
            },
            update: async (input) => {
              calls.profileUpdates.push(clone(input));
              profile = {
                ...profile,
                captureTarget: input.captureTarget ?? profile.captureTarget,
                cropRegions: input.cropRegions ?? profile.cropRegions,
                name: input.name ?? profile.name,
                overlayPlacements:
                  input.overlayPlacements ?? profile.overlayPlacements,
                targetFps: input.targetFps ?? profile.targetFps,
                updatedAt: fixture.now,
              };
              listeners.profilesChanged?.([clone(profile)]);

              return clone(profile);
            },
          },
        ),
        settings: createBridgeDomain<AuraOverlayE2EElectron["settings"]>(
          "settings",
          {
            get: async () => {
              calls.settingsReads += 1;

              return clone(fixture.settings);
            },
          },
        ),
      } as unknown as AuraOverlayE2EElectron;

      (
        window as unknown as {
          electron: AuraOverlayE2EElectron;
        }
      ).electron = electron;
    },
    {
      bridgeFactorySource: e2eBridgeDomainFactorySource,
      fixture: createAuraOverlayE2EFixture(options),
    },
  );

  await page.goto("/#/aura-overlay?profileId=profile-1");
  await expect(
    page.getByRole("application", { name: "Aura overlay" }),
  ).toBeVisible();
  await expect(page.getByText("Currently editing auras")).toBeVisible();
}

async function getAuraOverlayE2ECalls(
  page: Page,
): Promise<AuraOverlayE2ECalls> {
  return page.evaluate(() => {
    const e2eWindow = window as unknown as {
      __HINEKORA_AURA_OVERLAY_E2E__: AuraOverlayE2ECalls;
    };

    return e2eWindow.__HINEKORA_AURA_OVERLAY_E2E__;
  });
}

async function expectNoUnexpectedAuraOverlayBridgeCalls(page: Page) {
  const unexpectedBridgeCalls = await page.evaluate(() => {
    const e2eWindow = window as unknown as {
      __HINEKORA_AURA_OVERLAY_E2E__?: AuraOverlayE2ECalls;
    };

    return e2eWindow.__HINEKORA_AURA_OVERLAY_E2E__?.unexpectedBridgeCalls ?? [];
  });

  expect(unexpectedBridgeCalls).toEqual([]);
}

export {
  expectNoUnexpectedAuraOverlayBridgeCalls,
  getAuraOverlayE2ECalls,
  setupAuraOverlayE2E,
};
