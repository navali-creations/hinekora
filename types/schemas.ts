import { z } from "zod";

export const GameIdSchema = z.enum(["poe1", "poe2"]);
export type GameId = z.infer<typeof GameIdSchema>;

export const AppSetupStepSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type AppSetupStep = z.infer<typeof AppSetupStepSchema>;

export const CaptureTargetSchema = z.object({
  kind: z.enum(["display", "window"]),
  id: z.string().min(1).max(512),
  label: z.string().min(1).max(512),
  width: z.number().int().min(1).max(100_000).nullable().optional(),
  height: z.number().int().min(1).max(100_000).nullable().optional(),
});
export type CaptureTarget = z.infer<typeof CaptureTargetSchema>;

export const CapturePreviewSourceSchema = z.object({
  id: z.string().min(1).max(512),
  name: z.string().min(1).max(512),
  kind: z.enum(["screen", "window"]),
  game: GameIdSchema.nullable().optional(),
  displayId: z.string().max(128).nullable(),
  width: z.number().int().min(1).max(100_000).nullable().default(null),
  height: z.number().int().min(1).max(100_000).nullable().default(null),
  thumbnailDataUrl: z.string().max(500_000).nullable(),
});
export type CapturePreviewSource = z.infer<typeof CapturePreviewSourceSchema>;

const CoordinateReferenceSchema = {
  referenceWidth: z.number().int().min(1).max(100_000).optional(),
  referenceHeight: z.number().int().min(1).max(100_000).optional(),
};

export const CropRegionArcSchema = z.object({
  startX: z.number().int().min(0).max(100_000),
  startY: z.number().int().min(0).max(100_000),
  endX: z.number().int().min(0).max(100_000),
  endY: z.number().int().min(0).max(100_000),
  controlX: z.number().int().min(0).max(100_000),
  controlY: z.number().int().min(0).max(100_000),
  thickness: z.number().int().min(1).max(100_000),
});
export type CropRegionArc = z.infer<typeof CropRegionArcSchema>;

export const CropRegionSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(80),
    x: z.number().int().min(0).max(100_000),
    y: z.number().int().min(0).max(100_000),
    width: z.number().int().min(1).max(100_000),
    height: z.number().int().min(1).max(100_000),
    shape: z.enum(["rect", "arc"]).optional(),
    arc: CropRegionArcSchema.optional(),
    ...CoordinateReferenceSchema,
  })
  .superRefine((region, context) => {
    if (region.shape === "arc" && !region.arc) {
      context.addIssue({
        code: "custom",
        message: "Arched crop regions require arc metadata.",
        path: ["arc"],
      });
    }
  });
export type CropRegion = z.infer<typeof CropRegionSchema>;

export const OverlayPlacementSchema = z.object({
  id: z.string().min(1).max(128),
  cropRegionId: z.string().min(1).max(128),
  x: z.number().int().min(-100_000).max(100_000),
  y: z.number().int().min(-100_000).max(100_000),
  width: z.number().int().min(1).max(100_000).optional(),
  height: z.number().int().min(1).max(100_000).optional(),
  scale: z.number().min(0.1).max(8),
  opacity: z.number().min(0).max(1),
  arcVisibleThickness: z.number().int().min(1).max(100_000).optional(),
  arcStraightened: z.boolean().optional(),
  mirrored: z.boolean().optional(),
  rotationDegrees: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .optional(),
  ...CoordinateReferenceSchema,
});
export type OverlayPlacement = z.infer<typeof OverlayPlacementSchema>;

interface CoordinateReferenceInput {
  width: number;
  height: number;
}

export function createCoordinateReferenceDimensions(
  viewport: CoordinateReferenceInput,
): Pick<CropRegion, "referenceWidth" | "referenceHeight"> {
  return {
    referenceWidth: Math.round(viewport.width),
    referenceHeight: Math.round(viewport.height),
  };
}

export const ProfileSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(80),
  game: GameIdSchema,
  targetFps: z.number().int().min(1).max(240),
  captureTarget: CaptureTargetSchema.nullable(),
  cropRegions: z.array(CropRegionSchema).max(256),
  overlayPlacements: z.array(OverlayPlacementSchema).max(256),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileCreateInputSchema = z.object({
  name: z.string().min(1).max(80),
  game: GameIdSchema.default("poe1"),
});
export type ProfileCreateInput = z.infer<typeof ProfileCreateInputSchema>;

export const ProfileUpdateInputSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(80).optional(),
  targetFps: z.number().int().min(1).max(240).optional(),
  captureTarget: CaptureTargetSchema.nullable().optional(),
  cropRegions: z.array(CropRegionSchema).max(256).optional(),
  overlayPlacements: z.array(OverlayPlacementSchema).max(256).optional(),
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;

export const RecordingQualitySchema = z.enum([
  "low",
  "moderate",
  "high",
  "ultra",
]);
export type RecordingQuality = z.infer<typeof RecordingQualitySchema>;

export const RecordingEncoderChoiceSchema = z.enum([
  "hardware_h264",
  "hardware_h265",
  "hardware_av1",
  "obs_x264",
]);
export type RecordingEncoderChoice = z.infer<
  typeof RecordingEncoderChoiceSchema
>;

const LegacyRecordingEncoderSchema = z.enum([
  "auto",
  "obs_nvenc_h264_tex",
  "obs_nvenc_h264_soft",
  "obs_nvenc_h264_cuda",
  "obs_nvenc_hevc_tex",
  "obs_nvenc_hevc_soft",
  "obs_nvenc_hevc_cuda",
  "obs_nvenc_av1_tex",
  "obs_nvenc_av1_soft",
  "obs_nvenc_av1_cuda",
  "h264_texture_amf",
  "h264_fallback_amf",
  "h265_texture_amf",
  "h265_fallback_amf",
  "av1_texture_amf",
  "av1_fallback_amf",
  "obs_qsv11",
  "obs_qsv11_v2",
  "obs_qsv11_soft",
  "obs_qsv11_soft_v2",
  "obs_qsv11_hevc",
  "obs_qsv11_hevc_soft",
  "obs_qsv11_av1",
  "obs_qsv11_av1_soft",
]);

export const RecordingEncoderSchema = z.union([
  RecordingEncoderChoiceSchema,
  LegacyRecordingEncoderSchema,
]);
export type RecordingEncoder = z.infer<typeof RecordingEncoderSchema>;

export const RecordingEncoderOptions: {
  value: RecordingEncoderChoice;
  label: string;
}[] = [
  { value: "hardware_h264", label: "Hardware H.264 (Recommended)" },
  { value: "hardware_h265", label: "Hardware H.265" },
  { value: "hardware_av1", label: "Hardware AV1" },
  { value: "obs_x264", label: "OBS H.264 (Software)" },
];

export function normalizeRecordingEncoderChoice(
  encoder: RecordingEncoder | null | undefined,
): RecordingEncoderChoice {
  if (!encoder || encoder === "auto") {
    return "hardware_h264";
  }

  if (
    encoder === "hardware_h264" ||
    encoder === "hardware_h265" ||
    encoder === "hardware_av1" ||
    encoder === "obs_x264"
  ) {
    return encoder;
  }

  const normalizedEncoder = encoder.toLowerCase();
  if (normalizedEncoder.includes("av1")) {
    return "hardware_av1";
  }

  if (
    normalizedEncoder.includes("hevc") ||
    normalizedEncoder.includes("h265")
  ) {
    return "hardware_h265";
  }

  return "hardware_h264";
}

export const AppCloseBehaviorSchema = z.enum(["exit", "minimize-to-tray"]);
export type AppCloseBehavior = z.infer<typeof AppCloseBehaviorSchema>;

export const MainWindowBoundsSchema = z.object({
  x: z.number().int().min(-100_000).max(100_000),
  y: z.number().int().min(-100_000).max(100_000),
  width: z.number().int().min(1200).max(100_000),
  height: z.number().int().min(800).max(100_000),
});
export type MainWindowBounds = z.infer<typeof MainWindowBoundsSchema>;

export const RecorderOverlayBoundsSchema = z.object({
  x: z.number().int().min(-100_000).max(100_000),
  y: z.number().int().min(-100_000).max(100_000),
  width: z.number().int().min(236).max(100_000),
  height: z.number().int().min(42).max(100_000),
});
export type RecorderOverlayBounds = z.infer<typeof RecorderOverlayBoundsSchema>;

export const AppSettingsSchema = z.object({
  setupCompleted: z.boolean().default(false),
  setupStep: AppSetupStepSchema.default(0),
  setupVersion: z.number().int().min(1).max(1000).default(1),
  appCloseBehavior: AppCloseBehaviorSchema.default("exit"),
  appLaunchOnStartup: z.boolean().default(false),
  appStartMinimized: z.boolean().default(false),
  mainWindowBounds: MainWindowBoundsSchema.nullable().default(null),
  recorderOverlayBounds: RecorderOverlayBoundsSchema.nullable().default(null),
  installedGames: z.array(GameIdSchema).min(1).max(2).default(["poe1"]),
  recordingStoragePath: z.string().max(2_048).nullable().default(null),
  recordingOutputResolution: z.string().min(1).max(32).default("native"),
  recordingFps: z.number().int().min(1).max(240).default(30),
  recordingEncoder: RecordingEncoderSchema.default("hardware_h264"),
  recordingClipQuality: RecordingQualitySchema.default("high"),
  recordingRunQuality: RecordingQualitySchema.default("moderate"),
  recordingAudioInputDeviceId: z
    .string()
    .min(1)
    .max(512)
    .nullable()
    .default(null),
  recordingAudioOutputDeviceId: z
    .string()
    .min(1)
    .max(512)
    .nullable()
    .default(null),
  recordingHideOverlaysFromCapture: z.boolean().default(false),
  recordingMaxStorageGb: z.number().int().min(0).max(100_000).default(50),
  poe1ClientTxtPath: z.string().max(2_048).nullable().default(null),
  poe2ClientTxtPath: z.string().max(2_048).nullable().default(null),
  activeGame: GameIdSchema.default("poe1"),
  activeLeague: z.string().min(1).max(80).default("Standard"),
  poe1SelectedLeague: z.string().min(1).max(80).default("Standard"),
  poe2SelectedLeague: z.string().min(1).max(80).default("Standard"),
  editorAutoPruneProjects: z.boolean().default(false),
  deathClipSeconds: z.number().int().min(1).max(120).default(10),
  telemetryCrashReporting: z.boolean().default(false),
  telemetryUsageAnalytics: z.boolean().default(false),
  lastSeenAppVersion: z.string().min(1).max(64).nullable().default(null),
  onboardingDismissedBeacons: z
    .array(z.string().min(1).max(128))
    .max(128)
    .default([]),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const ManagedRecorderStatusSchema = z.object({
  available: z.boolean(),
  gameRunning: z.boolean(),
  initialized: z.boolean(),
  bufferActive: z.boolean(),
  recording: z.boolean(),
  isStartingRecording: z.boolean().default(false),
  isStoppingRecording: z.boolean().default(false),
  runRecordingActive: z.boolean().default(false),
  runtime: z.literal("packaged_obs"),
  runtimePath: z.string().max(2_048).nullable(),
  outputDirectory: z.string().max(2_048).nullable(),
  outputResolution: z.string().min(1).max(32),
  fps: z.number().int().min(1).max(240),
  encoder: z.string().min(1).max(128),
  lastRecordingPath: z.string().max(2_048).nullable(),
  runRecordingPath: z.string().max(2_048).nullable().default(null),
  activeSessionDirectory: z.string().max(2_048).nullable(),
  recordingStartedAt: z.string().datetime().nullable(),
  runRecordingStartedAt: z.string().datetime().nullable().default(null),
  error: z.string().max(2_048).nullable(),
});
export type ManagedRecorderStatus = z.infer<typeof ManagedRecorderStatusSchema>;

export const DeathClipStatusSchema = z.enum([
  "idle",
  "death_detected",
  "saving_replay",
  "processing",
  "ready",
  "failed",
]);
export type DeathClipStatus = z.infer<typeof DeathClipStatusSchema>;

export const ReplayClipKindSchema = z.enum(["death", "manual"]);
export type ReplayClipKind = z.infer<typeof ReplayClipKindSchema>;

export const ReplayClipSchema = z.object({
  id: z.string().min(1).max(128),
  kind: ReplayClipKindSchema.default("death"),
  status: DeathClipStatusSchema,
  sourceGame: GameIdSchema,
  sourceLeague: z.string().min(1).max(80).default("Standard"),
  deathTimestamp: z.string().datetime(),
  triggerLineHash: z.string().min(1).max(128),
  originalObsPath: z.string().max(2_048).nullable(),
  processedClipPath: z.string().max(2_048).nullable(),
  targetDurationSeconds: z.number().int().min(1).max(120),
  sizeBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  error: z.string().max(2_048).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReplayClip = z.infer<typeof ReplayClipSchema>;

export const ClientLogStatusSchema = z.object({
  activeGame: GameIdSchema,
  path: z.string().max(2_048).nullable(),
  watching: z.boolean(),
  lastError: z.string().nullable(),
});
export type ClientLogStatus = z.infer<typeof ClientLogStatusSchema>;

export const StateBundleSchema = z.object({
  format: z.literal("hinekora-state"),
  formatVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  appVersion: z.string().min(1).max(64),
  sections: z.object({
    profiles: z.array(ProfileSchema),
    settings: AppSettingsSchema,
    replayClips: z.array(ReplayClipSchema),
  }),
});
export type StateBundle = z.infer<typeof StateBundleSchema>;

export const StateImportModeSchema = z.enum(["merge", "replace"]);
export type StateImportMode = z.infer<typeof StateImportModeSchema>;

export const StateImportPreviewSchema = z.object({
  profileCount: z.number().int().min(0),
  replayClipCount: z.number().int().min(0),
  settingsIncluded: z.boolean(),
});
export type StateImportPreview = z.infer<typeof StateImportPreviewSchema>;

export function createDefaultProfile(input: ProfileCreateInput): Profile {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: input.name,
    game: input.game,
    targetFps: 30,
    captureTarget: null,
    cropRegions: [],
    overlayPlacements: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultSettings(): AppSettings {
  return AppSettingsSchema.parse({});
}
