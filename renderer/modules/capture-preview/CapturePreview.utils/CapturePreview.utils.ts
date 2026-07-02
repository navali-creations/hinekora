import {
  resolveActiveGameCaptureProfile,
  resolveCaptureProfileForGame,
  resolveSelectedCaptureProfile,
} from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { getGameLabel } from "~/renderer/modules/game/GameScope.constants";

import type {
  CapturePreviewSource,
  CaptureProfile,
  CaptureTarget,
  GameId,
} from "~/types";

const gameWindowFallbackOrder: GameId[] = ["poe1", "poe2"];
const unavailableGameWindowSourceIdPattern = /^missing-window:(poe1|poe2)$/;

function createUnavailableGameWindowSource(game: GameId): CapturePreviewSource {
  return {
    available: false,
    displayId: null,
    game,
    height: null,
    id: `missing-window:${game}`,
    kind: "window",
    name: `${getGameLabel(game)} (not running)`,
    thumbnailDataUrl: null,
    width: null,
  };
}

export function isCapturePreviewSourceAvailable(
  source: CapturePreviewSource | null | undefined,
): boolean {
  if (!source) {
    return false;
  }

  return source.available !== false;
}

export function isUnavailableGameWindowFallbackSource(
  source: CapturePreviewSource | null | undefined,
): boolean {
  return (
    source?.kind === "window" &&
    source.available === false &&
    Boolean(source.game) &&
    source.id === `missing-window:${source.game}`
  );
}

export function createCapturePreviewSourceLabel(
  source: CapturePreviewSource,
): string {
  if (isCapturePreviewSourceAvailable(source)) {
    return source.name;
  }

  return source.game
    ? `${getGameLabel(source.game)} (not running)`
    : source.name;
}

export function createCaptureTargetLabelFromPreviewSource(
  source: CapturePreviewSource,
): string {
  return source.game ? getGameLabel(source.game) : source.name;
}

export function createCaptureTargetFromPreviewSource(
  source: CapturePreviewSource,
): CaptureTarget {
  return {
    kind: source.kind === "screen" ? "display" : "window",
    id: source.kind === "screen" ? (source.displayId ?? source.id) : source.id,
    label: createCaptureTargetLabelFromPreviewSource(source),
    game: source.game ?? null,
    width: source.width,
    height: source.height,
  };
}

export function createCapturePreviewSourcesWithGameFallback(
  sources: CapturePreviewSource[],
): CapturePreviewSource[] {
  const unavailableGameSources = gameWindowFallbackOrder
    .filter(
      (game) =>
        !sources.some(
          (source) =>
            source.kind === "window" &&
            source.game === game &&
            isCapturePreviewSourceAvailable(source),
        ),
    )
    .map(createUnavailableGameWindowSource);

  if (unavailableGameSources.length === 0) {
    return sources;
  }

  return [...sources, ...unavailableGameSources];
}

export function sourceMatchesCaptureTarget(
  source: CapturePreviewSource,
  captureTarget: CaptureTarget | null | undefined,
): boolean {
  if (!captureTarget) {
    return false;
  }

  if (captureTarget.kind === "display") {
    return (
      source.kind === "screen" &&
      (source.id === captureTarget.id || source.displayId === captureTarget.id)
    );
  }

  if (source.kind !== "window") {
    return false;
  }

  if (source.id === captureTarget.id) {
    return true;
  }

  const captureTargetGame = captureTarget.game ?? null;
  const sourceGame = source.game ?? null;
  if (captureTargetGame && sourceGame) {
    return sourceGame === captureTargetGame;
  }

  return (
    normalizeWindowCaptureLabel(source.name) ===
    normalizeWindowCaptureLabel(captureTarget.label)
  );
}

function normalizeWindowCaptureLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();

  return normalized === "path of exile" ? "path of exile 1" : normalized;
}

export function findCapturePreviewSourceForTarget(
  captureTarget: CaptureTarget | null | undefined,
  sources: CapturePreviewSource[],
): CapturePreviewSource | null {
  return (
    sources.find((source) =>
      sourceMatchesCaptureTarget(source, captureTarget),
    ) ?? null
  );
}

function getUnavailableGameWindowSourceGame(
  sourceId: string | null,
): GameId | null {
  if (!sourceId) {
    return null;
  }

  const match = unavailableGameWindowSourceIdPattern.exec(sourceId);

  return match ? (match[1] as GameId) : null;
}

function findAvailableGameWindowSource(
  sources: CapturePreviewSource[],
  game: GameId,
): CapturePreviewSource | null {
  return (
    sources.find(
      (source) =>
        source.kind === "window" &&
        source.game === game &&
        isCapturePreviewSourceAvailable(source),
    ) ?? null
  );
}

function findGameWindowSource(
  sources: CapturePreviewSource[],
  game: GameId,
): CapturePreviewSource | null {
  return (
    findAvailableGameWindowSource(sources, game) ??
    sources.find(
      (source) =>
        source.kind === "window" &&
        source.game === game &&
        source.id === `missing-window:${game}`,
    ) ??
    null
  );
}

export function resolveCapturePreviewSourceId(
  captureTarget: CaptureTarget | null | undefined,
  sources: CapturePreviewSource[],
  selectedSourceId: string | null,
  activeGame?: GameId,
): string | null {
  const unavailableSelectedGame =
    getUnavailableGameWindowSourceGame(selectedSourceId);
  if (unavailableSelectedGame) {
    const liveSelectedGameSource = findAvailableGameWindowSource(
      sources,
      unavailableSelectedGame,
    );
    if (liveSelectedGameSource) {
      return liveSelectedGameSource.id;
    }
  }

  const profileSource = findCapturePreviewSourceForTarget(
    captureTarget,
    sources,
  );
  if (profileSource) {
    return profileSource.id;
  }

  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null;
  if (activeGame) {
    if (
      selectedSource?.game === activeGame &&
      isCapturePreviewSourceCompatibleWithGame(selectedSource, activeGame)
    ) {
      return selectedSource.id;
    }

    const activeGameSource = findGameWindowSource(sources, activeGame);
    if (activeGameSource) {
      return activeGameSource.id;
    }
  }

  if (
    selectedSource &&
    isCapturePreviewSourceCompatibleWithGame(selectedSource, activeGame)
  ) {
    return selectedSourceId;
  }

  return (
    sources.find((source) =>
      isCapturePreviewSourceCompatibleWithGame(source, activeGame),
    )?.id ?? null
  );
}

export function isCapturePreviewSourceCompatibleWithGame(
  source: CapturePreviewSource,
  activeGame: GameId | undefined,
): boolean {
  return !activeGame || !source.game || source.game === activeGame;
}

export function isSameCaptureTarget(
  left: CaptureTarget | null,
  right: CaptureTarget,
): boolean {
  return (
    left?.kind === right.kind &&
    left.id === right.id &&
    left.label === right.label &&
    left.game === right.game &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function resolveCaptureTargetProfile(
  profiles: CaptureProfile[],
  selectedProfileId: string | null,
  activeGame: GameId,
  source: CapturePreviewSource,
): CaptureProfile | null {
  if (source.game) {
    return resolveCaptureProfileForGame(
      profiles,
      selectedProfileId,
      source.game,
    );
  }

  const selectedProfile = resolveSelectedCaptureProfile(
    profiles,
    selectedProfileId,
  );
  if (selectedProfile) {
    return selectedProfile;
  }

  return resolveActiveGameCaptureProfile(
    profiles,
    selectedProfileId,
    activeGame,
  );
}

export function isCapturePreviewSourceCompatibleWithProfile(
  source: CapturePreviewSource,
  profile: CaptureProfile,
): boolean {
  return !source.game || source.game === profile.game;
}
