import { z } from "zod";

const ReplayStatusOverlayClipIdSchema = z.string().min(1).max(128);

const ReplayStatusOverlayEventSchema = z.object({
  clipId: ReplayStatusOverlayClipIdSchema,
  dismissing: z.boolean(),
  status: z.enum(["processing", "saved", "failed"]),
});

type ReplayStatusOverlayEvent = z.infer<typeof ReplayStatusOverlayEventSchema>;
type ReplayStatusOverlayFinalStatus = Exclude<
  ReplayStatusOverlayEvent["status"],
  "processing"
>;

export type { ReplayStatusOverlayEvent, ReplayStatusOverlayFinalStatus };
export { ReplayStatusOverlayClipIdSchema, ReplayStatusOverlayEventSchema };
