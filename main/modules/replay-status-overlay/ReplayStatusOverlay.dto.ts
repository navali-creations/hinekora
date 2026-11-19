import { z } from "zod";

const ReplayStatusOverlayClipIdSchema = z.string().min(1).max(128);

const ReplayStatusOverlayEventSchema = z.object({
  clipId: ReplayStatusOverlayClipIdSchema,
  dismissing: z.boolean(),
  status: z.enum(["saving", "processing", "saved", "failed"]),
});

type ReplayStatusOverlayEvent = z.infer<typeof ReplayStatusOverlayEventSchema>;
type ReplayStatusOverlayActiveStatus = Extract<
  ReplayStatusOverlayEvent["status"],
  "saving" | "processing"
>;
type ReplayStatusOverlayFinalStatus = Exclude<
  ReplayStatusOverlayEvent["status"],
  ReplayStatusOverlayActiveStatus
>;

export type {
  ReplayStatusOverlayActiveStatus,
  ReplayStatusOverlayEvent,
  ReplayStatusOverlayFinalStatus,
};
export { ReplayStatusOverlayClipIdSchema, ReplayStatusOverlayEventSchema };
