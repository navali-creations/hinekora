import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { FiEdit3 } from "react-icons/fi";

import type { ReplayClipDetail } from "~/main/modules/replay-clips";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import {
  type MediaDetailCopyState,
  MediaDetailPageActions,
} from "~/renderer/modules/media-library/MediaLibrary.components/MediaDetailPageActions/MediaDetailPageActions";
import { MediaDetailPlayer } from "~/renderer/modules/media-library/MediaLibrary.components/MediaDetailPlayer/MediaDetailPlayer";
import {
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
  getPathFileName,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

interface ClipDetailPageProps {
  clipId: string;
}

interface ClipDetailState {
  detail: ReplayClipDetail | null;
  error: string | null;
  isLoading: boolean;
}

interface FileActionMessage {
  text: string;
  tone: "error" | "success";
}

const initialClipDetailState: ClipDetailState = {
  detail: null,
  error: null,
  isLoading: true,
};

function ClipDetailPage({ clipId }: ClipDetailPageProps) {
  const [state, setState] = useState<ClipDetailState>(initialClipDetailState);
  const [copyState, setCopyState] = useState<MediaDetailCopyState>("idle");
  const [fileActionMessage, setFileActionMessage] =
    useState<FileActionMessage | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;
    setState(initialClipDetailState);
    setCopyState("idle");
    setFileActionMessage(null);

    window.electron.replayClips
      .get(clipId)
      .then((detail) => {
        if (isActive) {
          setState({ detail, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            detail: null,
            error: error instanceof Error ? error.message : "Clip failed",
            isLoading: false,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [clipId]);

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    },
    [],
  );

  const clip = state.detail?.clip ?? null;
  const clipPath = clip?.processedClipPath ?? clip?.originalObsPath;
  const title = clipPath ? getPathFileName(clipPath) : "Clip";
  const clipKindLabel = clip?.kind === "manual" ? "Manual clip" : "Death clip";
  const canUseFileActions = Boolean(clip && state.detail?.mediaUrl);
  const editAction = clip ? (
    <Link
      className="btn btn-primary btn-sm no-drag"
      search={{ id: clip.id, kind: "clip" }}
      to="/editor"
    >
      <FiEdit3 size={15} />
      Edit
    </Link>
  ) : null;

  const resetCopiedStateLater = () => {
    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current);
    }

    copyResetTimeoutRef.current = setTimeout(() => {
      setCopyState("idle");
      copyResetTimeoutRef.current = null;
    }, 1_800);
  };

  const handleOpenLocation = () => {
    if (!clip) {
      return;
    }

    setFileActionMessage(null);
    void window.electron.replayClips
      .reveal(clip.id)
      .then((result) => {
        if (!result.ok) {
          setFileActionMessage({
            text: result.error ?? "Could not open clip location.",
            tone: "error",
          });
        }
      })
      .catch((error: unknown) => {
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not open clip location.",
          tone: "error",
        });
      });
  };

  const handleCopyToClipboard = () => {
    if (!clip) {
      return;
    }

    setCopyState("copying");
    setFileActionMessage(null);
    void window.electron.replayClips
      .copy(clip.id)
      .then((result) => {
        if (result.ok) {
          setCopyState("copied");
          setFileActionMessage({
            text: "Video copied to clipboard.",
            tone: "success",
          });
          resetCopiedStateLater();
          return;
        }

        setCopyState("idle");
        setFileActionMessage({
          text: result.error ?? "Could not copy clip to clipboard.",
          tone: "error",
        });
      })
      .catch((error: unknown) => {
        setCopyState("idle");
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not copy clip to clipboard.",
          tone: "error",
        });
      });
  };

  return (
    <PageContainer>
      <PageHeader
        title={title}
        subtitle={
          clip
            ? `${clipKindLabel} - ${clip.sourceGame} - ${clip.sourceLeague}`
            : "Clip details"
        }
        actions={
          <MediaDetailPageActions
            canUseFileActions={canUseFileActions}
            copyState={copyState}
            extraAction={editAction}
            fallbackTo="/clips"
            onCopy={handleCopyToClipboard}
            onOpenLocation={handleOpenLocation}
          />
        }
      />
      <PageContent className="space-y-4">
        {fileActionMessage && (
          <div
            className={clsx("alert text-sm", {
              "alert-error": fileActionMessage.tone === "error",
              "alert-success": fileActionMessage.tone === "success",
            })}
            role="alert"
          >
            {fileActionMessage.text}
          </div>
        )}

        {state.isLoading && (
          <div className="flex items-center gap-3 text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Loading clip...</span>
          </div>
        )}

        {state.error && (
          <div className="alert alert-error text-sm" role="alert">
            {state.error}
          </div>
        )}

        {!state.isLoading && !state.error && !state.detail && (
          <div className="alert alert-warning text-sm" role="alert">
            Clip was not found.
          </div>
        )}

        {state.detail && clip && (
          <>
            <MediaDetailPlayer
              emptyDescription="The clip record exists, but the video file is missing or unavailable."
              emptyTitle="Clip video unavailable"
              mediaUrl={state.detail.mediaUrl}
              title={title}
            />

            <section className="grid gap-4 rounded-lg bg-base-200 p-4 md:grid-cols-4">
              <div>
                <div className="text-base-content/55 text-xs">Created</div>
                <div className="font-semibold text-sm">
                  {formatDateTime(clip.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-base-content/55 text-xs">Length</div>
                <div className="font-semibold text-sm">
                  {formatDurationSeconds(clip.targetDurationSeconds)}
                </div>
              </div>
              <div>
                <div className="text-base-content/55 text-xs">Size</div>
                <div className="font-semibold text-sm">
                  {formatBytes(clip.sizeBytes)}
                </div>
              </div>
              <div>
                <div className="text-base-content/55 text-xs">Status</div>
                <div className="font-semibold text-sm capitalize">
                  {clip.status.replaceAll("_", " ")}
                </div>
              </div>
            </section>
          </>
        )}
      </PageContent>
    </PageContainer>
  );
}

export { ClipDetailPage };
