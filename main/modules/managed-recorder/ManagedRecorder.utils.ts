import { type Dirent, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { detectPathOfExileWindowTitle } from "~/main/utils/path-of-exile-window-title";

import {
  type CaptureTarget,
  normalizeRecordingEncoderChoice,
  type RecordingEncoder,
  type RecordingEncoderChoice,
  type RecordingQuality,
} from "~/types";

const recordingExtensions = new Set([".flv", ".mkv", ".mov", ".mp4"]);
const invalidObsDisplay = "DUMMY";
const replaySaveBaseWaitMs = 15_000;
const replaySaveMinWaitMs = 30_000;
const replaySaveMaxWaitMs = 90_000;
const replaySaveReferencePixels = 1920 * 1080;
const replaySaveReferenceFps = 30;
const replaySaveReferenceSeconds = 10;
const softwareH264Encoder = "obs_x264";
const hardwareH264Encoders = [
  "obs_nvenc_h264_tex",
  "h264_texture_amf",
  "obs_qsv11_v2",
  "obs_qsv11",
  "obs_nvenc_h264_cuda",
  "obs_nvenc_h264_soft",
  "h264_fallback_amf",
  "obs_qsv11_soft_v2",
  "obs_qsv11_soft",
];
const hardwareH265Encoders = [
  "obs_nvenc_hevc_tex",
  "h265_texture_amf",
  "obs_qsv11_hevc",
  "obs_nvenc_hevc_cuda",
  "obs_nvenc_hevc_soft",
  "h265_fallback_amf",
  "obs_qsv11_hevc_soft",
];
const hardwareAv1Encoders = [
  "obs_nvenc_av1_tex",
  "av1_texture_amf",
  "obs_qsv11_av1",
  "obs_nvenc_av1_cuda",
  "obs_nvenc_av1_soft",
  "av1_fallback_amf",
  "obs_qsv11_av1_soft",
];

interface ManagedRecorderListItem {
  name: string;
  value: string | number;
  disabled?: boolean;
}

interface ManagedRecorderProperty {
  name: string;
  description?: string;
  type?: string;
  items?: ManagedRecorderListItem[];
}

interface ManagedRecorderResolution {
  width: number;
  height: number;
}

interface ReplaySaveWaitInput {
  requestedSeconds: number;
  outputResolution: ManagedRecorderResolution | null;
  fps: number;
}

interface ManagedVideoEncoderSettings {
  keyint_sec: number;
  rate_control: "CRF" | "CQP";
  crf?: number;
  cqp?: number;
}

interface ManagedRecorderSceneItemPosition {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatRecordingTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export function findNewestRecordingFile(
  directory: string,
  modifiedAfterMs = 0,
  ignoredPaths = new Set<string>(),
): string | null {
  let newestPath: string | null = null;
  let newestModifiedAtMs = 0;
  const pendingDirectories = [directory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent<string>[];
    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }

      if (!recordingExtensions.has(extname(entry.name).toLowerCase())) {
        continue;
      }
      const resolvedEntryPath = resolve(entryPath);
      if (ignoredPaths.has(resolvedEntryPath)) {
        continue;
      }

      let stats: ReturnType<typeof statSync>;
      try {
        stats = statSync(entryPath);
      } catch {
        continue;
      }

      if (
        stats.size <= 0 ||
        stats.mtimeMs < modifiedAfterMs ||
        stats.mtimeMs < newestModifiedAtMs
      ) {
        continue;
      }

      newestPath = resolvedEntryPath;
      newestModifiedAtMs = stats.mtimeMs;
    }
  }

  return newestPath;
}

export function collectRecordingFilePaths(directory: string): Set<string> {
  const paths = new Set<string>();
  const pendingDirectories = [directory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent<string>[];
    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }

      if (recordingExtensions.has(extname(entry.name).toLowerCase())) {
        paths.add(resolve(entryPath));
      }
    }
  }

  return paths;
}

export function resolveManagedCaptureSourceType(target: CaptureTarget): string {
  return target.kind === "window" ? "window_capture" : "monitor_capture";
}

export function parseScreenCaptureSourceIndex(targetId: string): number | null {
  const match = /^screen:(\d+):\d+$/i.exec(targetId);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);

  return index;
}

export function formatRecordingResolution(
  resolution: ManagedRecorderResolution,
): string {
  return `${resolution.width}x${resolution.height}`;
}

export function parseRecordingResolution(
  value: string,
): ManagedRecorderResolution | null {
  const [widthText, heightText] = value.split("x");
  const width = Number(widthText);
  const height = Number(heightText);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { width, height };
}

export function resolveManagedRecordingResolution(
  value: string,
  nativeResolution: ManagedRecorderResolution | null,
  sourceResolution: ManagedRecorderResolution | null,
  fallbackResolution: ManagedRecorderResolution,
): ManagedRecorderResolution {
  return (
    parseRecordingResolution(value) ??
    nativeResolution ??
    sourceResolution ??
    fallbackResolution
  );
}

export function resolveReplaySaveWaitMs({
  requestedSeconds,
  outputResolution,
  fps,
}: ReplaySaveWaitInput): number {
  const pixelFactor = outputResolution
    ? Math.max(
        1,
        (outputResolution.width * outputResolution.height) /
          replaySaveReferencePixels,
      )
    : 1;
  const fpsFactor = Math.max(1, fps / replaySaveReferenceFps);
  const durationFactor = Math.sqrt(
    Math.max(1, requestedSeconds / replaySaveReferenceSeconds),
  );
  const waitMs = Math.ceil(
    replaySaveBaseWaitMs * pixelFactor * fpsFactor * durationFactor,
  );

  return Math.min(replaySaveMaxWaitMs, Math.max(replaySaveMinWaitMs, waitMs));
}

export function resolveManagedVideoEncoderSettings(
  encoder: string,
  quality: RecordingQuality,
): ManagedVideoEncoderSettings {
  const qualityValue = resolveManagedVideoQualityValue(encoder, quality);
  const baseSettings = { keyint_sec: 1 };

  if (isManagedSoftwareEncoder(encoder)) {
    return {
      ...baseSettings,
      rate_control: "CRF",
      crf: qualityValue,
    };
  }

  return {
    ...baseSettings,
    rate_control: "CQP",
    cqp: qualityValue,
  };
}

export function resolveManagedVideoEncoder(
  encoder: RecordingEncoder,
  availableEncoders: readonly string[],
): string {
  const normalizedEncoder = normalizeRecordingEncoderChoice(encoder);

  if (normalizedEncoder === "obs_x264") {
    return softwareH264Encoder;
  }

  const availableEncoder = selectAvailableEncoder(
    resolveManagedEncoderCandidates(normalizedEncoder),
    availableEncoders,
  );

  return (
    availableEncoder ??
    selectAvailableEncoder(hardwareH264Encoders, availableEncoders) ??
    softwareH264Encoder
  );
}

function resolveManagedEncoderCandidates(
  encoder: Exclude<RecordingEncoderChoice, "obs_x264">,
): string[] {
  switch (encoder) {
    case "hardware_h264":
      return hardwareH264Encoders;
    case "hardware_h265":
      return hardwareH265Encoders;
    case "hardware_av1":
      return hardwareAv1Encoders;
  }
}

function selectAvailableEncoder(
  encoderCandidates: readonly string[],
  availableEncoders: readonly string[],
): string | null {
  const availableEncoderSet = new Set(availableEncoders);

  return (
    encoderCandidates.find((candidate) => availableEncoderSet.has(candidate)) ??
    null
  );
}

function resolveManagedVideoQualityValue(
  encoder: string,
  quality: RecordingQuality,
): number {
  const isAv1 = encoder.toLowerCase().includes("av1");
  if (isAv1) {
    switch (quality) {
      case "ultra":
        return 20;
      case "high":
        return 24;
      case "moderate":
        return 28;
      case "low":
        return 32;
    }
  }

  switch (quality) {
    case "ultra":
      return 22;
    case "high":
      return 26;
    case "moderate":
      return 30;
    case "low":
      return 34;
  }
}

function isManagedSoftwareEncoder(encoder: string): boolean {
  return encoder === "obs_x264";
}

export function createFittedSceneItemPosition(
  source: ManagedRecorderResolution,
  canvas: ManagedRecorderResolution,
): ManagedRecorderSceneItemPosition {
  const scale = Math.min(
    canvas.width / source.width,
    canvas.height / source.height,
  );
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    scaleX: scale,
    scaleY: scale,
    cropLeft: 0,
    cropRight: 0,
    cropTop: 0,
    cropBottom: 0,
  };
}

export function selectDisplayMonitor(
  properties: ManagedRecorderProperty[],
  target: CaptureTarget,
): ManagedRecorderListItem | null {
  const monitorProperty = properties.find((property) => {
    return property.name === "monitor_id" && Array.isArray(property.items);
  });

  const items =
    monitorProperty?.items?.filter(
      (item) => !item.disabled && String(item.value) !== invalidObsDisplay,
    ) ?? [];

  return (
    findMatchingPropertyItem(items, target) ??
    items.find((item) => item.name.toLowerCase().includes("primary")) ??
    items[0] ??
    null
  );
}

export function selectWindow(
  properties: ManagedRecorderProperty[],
  target: CaptureTarget,
): ManagedRecorderListItem | null {
  const windowProperty = properties.find((property) => {
    return property.name === "window" && Array.isArray(property.items);
  });
  const items =
    windowProperty?.items?.filter(
      (item) => !item.disabled && String(item.value).length > 0,
    ) ?? [];

  return findMatchingPropertyItem(items, target) ?? null;
}

export function selectWgcCaptureMethod(
  properties: ManagedRecorderProperty[],
): number | null {
  const methodProperty = properties.find((property) => {
    return property.name === "method" && Array.isArray(property.items);
  });
  const items =
    methodProperty?.items?.filter(
      (item): item is ManagedRecorderListItem & { value: number } =>
        !item.disabled && typeof item.value === "number",
    ) ?? [];

  return (
    items.find((item) => {
      const name = item.name.toLowerCase();

      return name.includes("windows 10") || name.includes("wgc");
    })?.value ??
    items.find((item) => item.name.toLowerCase().includes("automatic"))
      ?.value ??
    null
  );
}

function findMatchingPropertyItem(
  items: ManagedRecorderListItem[],
  target: CaptureTarget,
): ManagedRecorderListItem | null {
  const poeWindowGame = detectPathOfExileWindowTarget(target);
  if (poeWindowGame) {
    const poeWindowItem =
      items.find((item) =>
        isMatchingPathOfExileWindowItem(item, poeWindowGame),
      ) ?? null;
    if (poeWindowItem) {
      return poeWindowItem;
    }
  }

  const targetTokens = createCaptureTargetMatchTokens(target);

  return (
    items.find((item) => {
      const value = String(item.value).toLowerCase();
      const name = item.name.toLowerCase();

      return targetTokens.some(
        (token) => value.includes(token) || name.includes(token),
      );
    }) ?? null
  );
}

function detectPathOfExileWindowTarget(
  target: CaptureTarget,
): "poe1" | "poe2" | null {
  if (target.kind !== "window") {
    return null;
  }

  return detectPathOfExileWindowTitle(target.label);
}

function isMatchingPathOfExileWindowItem(
  item: ManagedRecorderListItem,
  game: "poe1" | "poe2",
): boolean {
  return [item.name, String(item.value)].some((value) => {
    return detectPathOfExileWindowTitleFromObsProperty(value) === game;
  });
}

function detectPathOfExileWindowTitleFromObsProperty(
  value: string,
): "poe1" | "poe2" | null {
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  const bracketTitle = /^\[[^\]]+\]:\s*(.+)$/.exec(normalized)?.[1] ?? null;
  const candidates = [
    normalized,
    normalized.split(":")[0]!.trim(),
    bracketTitle ?? "",
    bracketTitle?.split(":")[0]?.trim() ?? "",
  ];

  for (const candidate of candidates) {
    const game = detectPathOfExileWindowTitle(candidate);
    if (game) {
      return game;
    }
  }

  return null;
}

function createCaptureTargetMatchTokens(target: CaptureTarget): string[] {
  const tokens = [target.id, target.label];
  const screenMatch = /^screen:([^:]+):(\d+)$/i.exec(target.id);
  const [, displayId, displayIndex] = screenMatch ?? [];
  if (displayId && displayIndex) {
    tokens.push(displayId, displayIndex);
  }

  return tokens
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);
}

export type {
  ManagedRecorderListItem,
  ManagedRecorderProperty,
  ManagedRecorderResolution,
  ManagedRecorderSceneItemPosition,
  ManagedVideoEncoderSettings,
  ReplaySaveWaitInput,
};
