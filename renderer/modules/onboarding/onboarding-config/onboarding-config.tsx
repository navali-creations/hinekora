import {
  AnchorPoint,
  Animation,
  PositioningStrategy,
  type RepereReactConfig,
} from "@repere/react";
import type { ComponentType } from "react";

import { AuraLockBeacon } from "../Onboarding.beacons/AuraLockBeacon/AuraLockBeacon";
import { AuraNewAuraBeacon } from "../Onboarding.beacons/AuraNewAuraBeacon/AuraNewAuraBeacon";
import { AuraProfileBeacon } from "../Onboarding.beacons/AuraProfileBeacon/AuraProfileBeacon";
import { AuraSourcePositionBeacon } from "../Onboarding.beacons/AuraSourcePositionBeacon/AuraSourcePositionBeacon";
import { CaptureModeBeacon } from "../Onboarding.beacons/CaptureModeBeacon/CaptureModeBeacon";
import { CaptureSettingsBeacon } from "../Onboarding.beacons/CaptureSettingsBeacon/CaptureSettingsBeacon";
import { CaptureSourceBeacon } from "../Onboarding.beacons/CaptureSourceBeacon/CaptureSourceBeacon";
import { EditorMoreOptionsBeacon } from "../Onboarding.beacons/EditorMoreOptionsBeacon/EditorMoreOptionsBeacon";
import { EditorMyMediaBeacon } from "../Onboarding.beacons/EditorMyMediaBeacon/EditorMyMediaBeacon";
import { EditorPreviewSourceBeacon } from "../Onboarding.beacons/EditorPreviewSourceBeacon/EditorPreviewSourceBeacon";
import { EditorProfilesBeacon } from "../Onboarding.beacons/EditorProfilesBeacon/EditorProfilesBeacon";
import { EditorTimelineBeacon } from "../Onboarding.beacons/EditorTimelineBeacon/EditorTimelineBeacon";
import { GameSelectorBeacon } from "../Onboarding.beacons/GameSelectorBeacon/GameSelectorBeacon";
import { OverlayIconBeacon } from "../Onboarding.beacons/OverlayIconBeacon/OverlayIconBeacon";
import { StartRecordingBeacon } from "../Onboarding.beacons/StartRecordingBeacon/StartRecordingBeacon";
import { OnboardingTrigger } from "../Onboarding.components/OnboardingTrigger/OnboardingTrigger";
import { repereStoreAdapter } from "../repereStoreAdapter/repereStoreAdapter";
import {
  type OnboardingBeaconId,
  onboardingBeaconRegistry,
} from "./onboarding-registry";

type BeaconOffset = {
  x?: number;
  y?: number;
};

type BeaconVisualConfig = {
  trigger: {
    anchorPoint: AnchorPoint;
    offset?: BeaconOffset;
  };
  popover: {
    component: ComponentType<unknown>;
    anchorPoint?: AnchorPoint;
    offset?: BeaconOffset;
  };
};

const beaconVisualConfigById = {
  "game-selector": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: GameSelectorBeacon as ComponentType<unknown>,
      offset: { y: 10 },
    },
  },
  "overlay-icon": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
    },
    popover: {
      component: OverlayIconBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "capture-mode": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: CaptureModeBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomLeft,
      offset: { y: 10 },
    },
  },
  "start-recording": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: StartRecordingBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "capture-source": {
    trigger: {
      anchorPoint: AnchorPoint.TopCenter,
      offset: { y: -5 },
    },
    popover: {
      component: CaptureSourceBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.RightCenter,
      offset: { x: 20 },
    },
  },
  "capture-settings": {
    trigger: {
      anchorPoint: AnchorPoint.TopLeft,
      offset: { x: 8, y: 8 },
    },
    popover: {
      component: CaptureSettingsBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.TopCenter,
      offset: { y: 10 },
    },
  },
  "aura-profile-select": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: AuraProfileBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 10 },
    },
  },
  "aura-lock-toggle": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: AuraLockBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "aura-new-aura": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: AuraNewAuraBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "aura-source-position": {
    trigger: {
      anchorPoint: AnchorPoint.TopCenter,
      offset: { y: -5 },
    },
    popover: {
      component: AuraSourcePositionBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomLeft,
      offset: { y: 10 },
    },
  },
  "editor-my-media": {
    trigger: {
      anchorPoint: AnchorPoint.TopCenter,
      offset: { y: -5 },
    },
    popover: {
      component: EditorMyMediaBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomLeft,
      offset: { y: 10 },
    },
  },
  "editor-preview-source": {
    trigger: {
      anchorPoint: AnchorPoint.RightCenter,
      offset: { x: -20 },
    },
    popover: {
      component: EditorPreviewSourceBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "editor-profiles": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: EditorProfilesBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "editor-more-options": {
    trigger: {
      anchorPoint: AnchorPoint.BottomCenter,
      offset: { y: 5 },
    },
    popover: {
      component: EditorMoreOptionsBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomRight,
      offset: { y: 10 },
    },
  },
  "editor-timeline": {
    trigger: {
      anchorPoint: AnchorPoint.TopCenter,
      offset: { y: -5 },
    },
    popover: {
      component: EditorTimelineBeacon as ComponentType<unknown>,
      anchorPoint: AnchorPoint.BottomLeft,
      offset: { y: 10 },
    },
  },
} satisfies Record<OnboardingBeaconId, BeaconVisualConfig>;

const onboardingConfig: RepereReactConfig = {
  store: repereStoreAdapter,
  trigger: {
    delay: 500,
    positioningStrategy: PositioningStrategy.Fixed,
    animations: {
      onRender: Animation.SlideDown,
      onDismiss: Animation.Fade,
    },
    component: OnboardingTrigger,
  },
  popover: {
    animations: {
      onOpen: Animation.SlideDown,
      onClose: Animation.Fade,
    },
  },
  pages: onboardingBeaconRegistry.map((page) => ({
    id: page.id,
    path: page.path,
    beacons: page.beacons.map((beacon) => ({
      id: beacon.id,
      selector: beacon.selector,
      ...beaconVisualConfigById[beacon.id],
    })),
  })),
};

export { onboardingConfig };
