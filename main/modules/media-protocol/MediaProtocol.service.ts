import { net, protocol } from "electron";

import { logInfo, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import { createMediaFileResponse } from "./MediaProtocol.response";
import type { MediaKind, MediaRequestTarget } from "./MediaProtocol.urls";
import {
  mediaProtocolScheme,
  resolveMediaRequestTarget,
} from "./MediaProtocol.urls";

const replayMediaDiagnosticsEnabled =
  process.env.HINEKORA_CLIP_PREVIEW_DIAGNOSTICS === "1";

interface MediaPathResolvers {
  resolveClipPreviewPath: (id: string) => string | null;
  resolveReplayClipPath: (id: string) => string | null;
  resolveRunRecordingPath: (id: string) => string | null;
}

function setupMediaProtocol(resolvers: MediaPathResolvers): void {
  try {
    if (protocol.isProtocolHandled(mediaProtocolScheme)) {
      return;
    }

    protocol.handle(mediaProtocolScheme, (request) =>
      handleMediaRequest(request, resolvers),
    );
  } catch (error) {
    logWarn("media-protocol", "Media protocol setup failed", {
      error: safeErrorMessage(error),
    });
  }
}

async function handleMediaRequest(
  request: GlobalRequest,
  resolvers: MediaPathResolvers,
): Promise<Response> {
  const startedAt = Date.now();
  const target = resolveMediaRequestTarget(request.url);
  if (!target) {
    return new Response(null, { status: 404 });
  }

  const mediaPath = resolveMediaPath(target, resolvers);
  if (!mediaPath) {
    logWarn("media-protocol", "Media file missing", {
      mediaId: target.id,
      mediaKind: target.kind,
    });
    return new Response(null, { status: 404 });
  }

  try {
    const response = await createMediaFileResponse(
      mediaPath,
      request,
      (url, init) => net.fetch(url, init),
    );
    if (replayMediaDiagnosticsEnabled) {
      logInfo("media-protocol", "Media response ready", {
        elapsedMs: Date.now() - startedAt,
        mediaId: target.id,
        mediaKind: target.kind,
        range: request.headers.get("range"),
        status: response.status,
      });
    }

    return response;
  } catch (error) {
    logWarn("media-protocol", "Media response failed", {
      mediaId: target.id,
      mediaKind: target.kind,
      error: safeErrorMessage(error),
    });
    return new Response(null, { status: 500 });
  }
}

function resolveMediaPath(
  target: MediaRequestTarget,
  resolvers: MediaPathResolvers,
): string | null {
  const resolverByKind: Record<MediaKind, (id: string) => string | null> = {
    "clip-preview": resolvers.resolveClipPreviewPath,
    "replay-clip": resolvers.resolveReplayClipPath,
    "run-recording": resolvers.resolveRunRecordingPath,
  };
  return resolverByKind[target.kind](target.id);
}

export { handleMediaRequest, setupMediaProtocol };
