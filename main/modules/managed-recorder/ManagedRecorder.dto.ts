import { z } from "zod";

import {
  type ExplicitRecordingOutputResolution,
  ExplicitRecordingOutputResolutionSchema,
  type ManagedRecorderStatus,
  type RecordingEncoderChoice,
  RecordingEncoderChoiceSchema,
  type RecordingQuality,
  RecordingQualitySchema,
} from "~/types";

export type ManagedReplayKind = "death" | "manual";
export type ManagedRecorderCaptureMode = "session" | "rewind";
export type ManagedRecorderAudioDeviceKind = "input" | "output";
export type ManagedRecorderAudioOutputState =
  | "available"
  | "disabled"
  | "unavailable";

export interface ManagedRecorderAudioDevice {
  id: string;
  label: string;
}

export interface ManagedRecorderAudioDevices {
  input: ManagedRecorderAudioDevice[];
  output: ManagedRecorderAudioDevice[];
}

export interface ManagedRecorderListAudioDevicesOptions {
  forceRefresh?: boolean;
}

const ManagedRecordingStorageEstimateConfigurationSchema = z.object({
  durationMinutes: z.number().int().min(1).max(1_440).optional(),
  encoder: RecordingEncoderChoiceSchema,
  fps: z.union([z.literal(30), z.literal(60)]),
  key: z.string().min(1).max(128),
  quality: RecordingQualitySchema,
  resolution: ExplicitRecordingOutputResolutionSchema.optional(),
});
const ManagedRecordingStorageEstimateRequestSchema = z.object({
  configurations: z
    .array(ManagedRecordingStorageEstimateConfigurationSchema)
    .min(1)
    .max(16),
});

export const managedRecordingStorageEstimateDurations = [
  { label: "10 min", minutes: 10 },
  { label: "30 min", minutes: 30 },
  { label: "1 hr", minutes: 60 },
  { label: "2 hr", minutes: 120 },
  { label: "5 hr", minutes: 300 },
  { label: "10 hr", minutes: 600 },
  { label: "16 hr", minutes: 960 },
  { label: "24 hr", minutes: 1_440 },
] as const;

export type ManagedRecordingStorageEstimateConfiguration = z.infer<
  typeof ManagedRecordingStorageEstimateConfigurationSchema
>;
export type ManagedRecordingStorageEstimateRequest = z.infer<
  typeof ManagedRecordingStorageEstimateRequestSchema
>;

export interface ManagedRecordingStorageEstimateDuration {
  durationMinutes: number;
  estimatedBytes: number;
}

export interface ManagedRecordingStorageEstimateRow {
  estimates: ManagedRecordingStorageEstimateDuration[];
  height: number;
  resolution: ExplicitRecordingOutputResolution;
  width: number;
}

export interface ManagedRecordingStorageEstimate {
  fps: number;
  key: string;
  quality: RecordingQuality;
  requestedEncoder: RecordingEncoderChoice;
  rows: ManagedRecordingStorageEstimateRow[];
}

export interface ManagedRecordingStorageEstimateResponse {
  configurations: ManagedRecordingStorageEstimate[];
}

export interface ManagedReplaySaveResult {
  ok: boolean;
  path: string | null;
  error: string | null;
}

export type { ManagedRecorderStatus };
export { ManagedRecordingStorageEstimateRequestSchema };
