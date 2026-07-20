import clsx from "clsx";
import { type MouseEvent, useMemo } from "react";
import { createPortal } from "react-dom";
import { FiCheck } from "react-icons/fi";
import { TbTimeDuration30 } from "react-icons/tb";

import { useBoundStore } from "~/renderer/store";

import {
  defaultEditorTimelinePlaybackRate,
  type EditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
  isEditorTimelinePlaybackRate,
} from "~/types";
import { createUnavailablePlaybackRates } from "./EditorTimelineSpeedMenu.utils";
import { useEditorTimelineSpeedMenu } from "./useEditorTimelineSpeedMenu/useEditorTimelineSpeedMenu";

const noUnavailablePlaybackRates: ReadonlySet<EditorTimelinePlaybackRate> =
  new Set();

function EditorTimelineSpeedMenu() {
  const isProcessing = useBoundStore(
    (state) => state.editor.clipboardState.status === "copying",
  );
  const project = useBoundStore((state) => state.editor.project);
  const selectedClipId = useBoundStore((state) => state.editor.selectedClipId);
  const selectedTimelineClip =
    project?.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) ?? null;
  const selectedPlaybackRate =
    selectedTimelineClip?.playbackRate ?? defaultEditorTimelinePlaybackRate;
  const canChangeClipSpeed = !isProcessing && selectedTimelineClip !== null;
  const {
    closeMenuAndFocusTrigger,
    containerRef,
    handleMenuKeyDown,
    handleToggleMenu,
    handleTriggerKeyDown,
    isOpen,
    menuPosition,
    menuRef,
    setMenuItemRef,
    triggerRef,
  } = useEditorTimelineSpeedMenu({
    canChangeClipSpeed,
    selectedPlaybackRate,
  });
  const unavailablePlaybackRates = useMemo(
    () =>
      isOpen
        ? createUnavailablePlaybackRates({
            clipId: selectedClipId,
            project,
          })
        : noUnavailablePlaybackRates,
    [isOpen, project, selectedClipId],
  );

  const handlePlaybackRateClick = (event: MouseEvent<HTMLUListElement>) => {
    if (!canChangeClipSpeed || !(event.target instanceof Element)) {
      return;
    }

    const option = event.target.closest<HTMLButtonElement>(
      "button[data-playback-rate]",
    );
    const playbackRate = Number(option?.dataset.playbackRate);
    if (option?.disabled || !isEditorTimelinePlaybackRate(playbackRate)) {
      return;
    }

    useBoundStore
      .getState()
      .editor.setSelectedTimelineClipPlaybackRate(playbackRate);
    closeMenuAndFocusTrigger();
  };

  return (
    <div className="relative" ref={containerRef}>
      <span
        className="tooltip tooltip-bottom"
        data-tip={`Clip speed: ${selectedPlaybackRate}x`}
      >
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Clip speed: ${selectedPlaybackRate}x`}
          className={clsx("btn btn-square btn-xs h-6 min-h-6 w-6", {
            "btn-ghost":
              selectedPlaybackRate === defaultEditorTimelinePlaybackRate,
            "btn-primary":
              selectedPlaybackRate !== defaultEditorTimelinePlaybackRate,
          })}
          disabled={!canChangeClipSpeed}
          ref={triggerRef}
          type="button"
          onClick={handleToggleMenu}
          onKeyDown={handleTriggerKeyDown}
        >
          <TbTimeDuration30 size={20} />
        </button>
      </span>
      {isOpen &&
        menuPosition !== null &&
        createPortal(
          <ul
            aria-label="Clip speed options"
            className="menu fixed z-[100] w-16 -translate-x-1/2 rounded-md border border-base-content/10 bg-base-200 p-1 shadow-lg"
            ref={menuRef}
            role="menu"
            style={menuPosition}
            onClick={handlePlaybackRateClick}
            onKeyDown={handleMenuKeyDown}
          >
            {editorTimelinePlaybackRates.map((playbackRate, index) => {
              const isSelected = playbackRate === selectedPlaybackRate;

              return (
                <li key={playbackRate}>
                  <button
                    aria-checked={isSelected}
                    className={clsx(
                      "flex h-7 min-h-7 flex-row items-center justify-between rounded-md px-1.5 text-xs",
                      { active: isSelected },
                    )}
                    data-playback-rate={playbackRate}
                    disabled={unavailablePlaybackRates.has(playbackRate)}
                    ref={(item) => setMenuItemRef(index, item)}
                    role="menuitemradio"
                    tabIndex={isSelected ? 0 : -1}
                    type="button"
                  >
                    <span>{playbackRate}x</span>
                    {isSelected && <FiCheck aria-hidden="true" size={12} />}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}

export { EditorTimelineSpeedMenu };
