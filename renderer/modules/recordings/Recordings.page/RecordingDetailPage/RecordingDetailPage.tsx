import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { FiEdit3 } from "react-icons/fi";

import type { RunRecordingDetail } from "~/main/modules/recording-storage";
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
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

interface RecordingDetailPageProps {
  recordingId: string;
}

interface RecordingDetailState {
  detail: RunRecordingDetail | null;
  error: string | null;
  isLoading: boolean;
}

interface FileActionMessage {
  text: string;
  tone: "error" | "success";
}

const initialRecordingDetailState: RecordingDetailState = {
  detail: null,
  error: null,
  isLoading: true,
};

function RecordingDetailPage({ recordingId }: RecordingDetailPageProps) {
  const [state, setState] = useState<RecordingDetailState>(
    initialRecordingDetailState,
  );
  const [copyState, setCopyState] = useState<MediaDetailCopyState>("idle");
  const [fileActionMessage, setFileActionMessage] =
    useState<FileActionMessage | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;
    setState(initialRecordingDetailState);
    setCopyState("idle");
    setFileActionMessage(null);

    window.electron.recordingStorage
      .getRecording(recordingId)
      .then((detail) => {
        if (isActive) {
          setState({ detail, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            detail: null,
            error: error instanceof Error ? error.message : "Recording failed",
            isLoading: false,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [recordingId]);

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    },
    [],
  );

  const recording = state.detail?.recording ?? null;
  const canUseFileActions = Boolean(
    recording?.exists && state.detail?.mediaUrl,
  );
  const editAction = recording ? (
    <Link
      className="btn btn-primary btn-sm no-drag"
      search={{ id: recording.id, kind: "recording" }}
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
    if (!recording) {
      return;
    }

    setFileActionMessage(null);
    void window.electron.recordingStorage
      .revealRecording(recording.path)
      .then((result) => {
        if (!result.ok) {
          setFileActionMessage({
            text: result.error ?? "Could not open recording location.",
            tone: "error",
          });
        }
      })
      .catch((error: unknown) => {
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not open recording location.",
          tone: "error",
        });
      });
  };

  const handleCopyToClipboard = () => {
    if (!recording) {
      return;
    }

    setCopyState("copying");
    setFileActionMessage(null);
    void window.electron.recordingStorage
      .copyRecording(recording.path)
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
          text: result.error ?? "Could not copy recording to clipboard.",
          tone: "error",
        });
      })
      .catch((error: unknown) => {
        setCopyState("idle");
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not copy recording to clipboard.",
          tone: "error",
        });
      });
  };

  return (
    <PageContainer>
      <PageHeader
        title={recording?.fileName ?? "Recording"}
        subtitle={
          recording
            ? `Full recording - ${recording.sourceGame} - ${recording.sourceLeague}`
            : "Recording details"
        }
        actions={
          <MediaDetailPageActions
            canUseFileActions={canUseFileActions}
            copyState={copyState}
            extraAction={editAction}
            fallbackTo="/recordings"
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
            <span className="text-sm">Loading recording...</span>
          </div>
        )}

        {state.error && (
          <div className="alert alert-error text-sm" role="alert">
            {state.error}
          </div>
        )}

        {!state.isLoading && !state.error && !state.detail && (
          <div className="alert alert-warning text-sm" role="alert">
            Recording was not found.
          </div>
        )}

        {state.detail && recording && (
          <>
            <MediaDetailPlayer
              emptyDescription="The recording record exists, but the video file is missing or unavailable."
              emptyTitle="Recording video unavailable"
              mediaUrl={state.detail.mediaUrl}
              title={recording.fileName}
            />

            <section className="grid gap-4 rounded-lg bg-base-200 p-4 md:grid-cols-4">
              <div>
                <div className="text-base-content/55 text-xs">Saved</div>
                <div className="font-semibold text-sm">
                  {formatDateTime(recording.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-base-content/55 text-xs">Length</div>
                <div className="font-semibold text-sm">
                  {formatDurationSeconds(recording.durationSeconds)}
                </div>
              </div>
              <div>
                <div className="text-base-content/55 text-xs">Size</div>
                <div className="font-semibold text-sm">
                  {formatBytes(recording.sizeBytes)}
                </div>
              </div>
              <div>
                <div className="text-base-content/55 text-xs">File</div>
                <div className="truncate font-semibold text-sm">
                  {recording.exists ? "Available" : "Missing"}
                </div>
              </div>
            </section>
          </>
        )}
      </PageContent>
    </PageContainer>
  );
}

export { RecordingDetailPage };
