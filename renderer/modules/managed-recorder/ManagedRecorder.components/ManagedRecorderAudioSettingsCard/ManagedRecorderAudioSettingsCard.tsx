import clsx from "clsx";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiRefreshCw } from "react-icons/fi";

import type { ManagedRecorderAudioDevices } from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import {
  useManagedRecorderSelector,
  useSettingsShallow,
} from "~/renderer/store";

import { ManagedRecorderAudioDeviceErrorState } from "../ManagedRecorderAudioDeviceErrorState/ManagedRecorderAudioDeviceErrorState";
import { ManagedRecorderAudioDeviceLoadingState } from "../ManagedRecorderAudioDeviceLoadingState/ManagedRecorderAudioDeviceLoadingState";
import { ManagedRecorderAudioDeviceSelects } from "../ManagedRecorderAudioDeviceSelects/ManagedRecorderAudioDeviceSelects";
import {
  createAudioDeviceOptions,
  resolveAudioDeviceValue,
  resolveAudioOptionValue,
  waitForAudioDeviceLoadPaint,
} from "./ManagedRecorderAudioSettingsCard.utils";

const emptyAudioDevices: ManagedRecorderAudioDevices = {
  input: [],
  output: [],
};
type AudioDeviceLoadStatus = "idle" | "loading" | "loaded" | "failed";

function ManagedRecorderAudioSettingsCard() {
  const [audioDevices, setAudioDevices] =
    useState<ManagedRecorderAudioDevices>(emptyAudioDevices);
  const [audioDeviceLoadStatus, setAudioDeviceLoadStatus] =
    useState<AudioDeviceLoadStatus>("idle");
  const isMountedRef = useRef(true);
  const audioDeviceLoadRequestIdRef = useRef(0);
  const { settingsValue, updateSettings } = useSettingsShallow((settings) => ({
    settingsValue: settings.value,
    updateSettings: settings.update,
  }));
  const status = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status,
  );
  const isRecording = status?.recording === true;
  const isBusy =
    status?.isStartingRecording === true ||
    status?.isStoppingRecording === true;
  const isLoadingAudioDevices = audioDeviceLoadStatus === "loading";
  const hasLoadedAudioDevices =
    audioDevices.input.length > 0 || audioDevices.output.length > 0;
  const showAudioDeviceLoadingState =
    isLoadingAudioDevices && !hasLoadedAudioDevices;
  const showAudioDeviceErrorState =
    audioDeviceLoadStatus === "failed" && !hasLoadedAudioDevices;
  const audioDevicesRefreshTitle =
    audioDeviceLoadStatus === "failed"
      ? "Audio device refresh failed. Try again."
      : isLoadingAudioDevices
        ? "Refreshing audio devices"
        : "Refresh audio devices";
  const selectedAudioInputId =
    settingsValue?.recordingAudioInputDeviceId ?? null;
  const selectedAudioOutputId =
    settingsValue?.recordingAudioOutputDeviceId ?? null;
  const audioInputOptions = useMemo(
    () =>
      createAudioDeviceOptions({
        devices: audioDevices.input,
        disabledLabel: "No input audio",
        defaultLabel: "Default input device",
      }),
    [audioDevices.input],
  );
  const audioOutputOptions = useMemo(
    () =>
      createAudioDeviceOptions({
        devices: audioDevices.output,
        disabledLabel: "No output audio",
        defaultLabel: "Default output device",
      }),
    [audioDevices.output],
  );
  const audioInputValue = useMemo(
    () => resolveAudioOptionValue(audioInputOptions, selectedAudioInputId),
    [audioInputOptions, selectedAudioInputId],
  );
  const audioOutputValue = useMemo(
    () => resolveAudioOptionValue(audioOutputOptions, selectedAudioOutputId),
    [audioOutputOptions, selectedAudioOutputId],
  );

  const loadAudioDevices = useCallback(
    async (forceRefresh = false): Promise<void> => {
      const requestId = audioDeviceLoadRequestIdRef.current + 1;
      audioDeviceLoadRequestIdRef.current = requestId;
      setAudioDeviceLoadStatus("loading");
      await waitForAudioDeviceLoadPaint();
      if (
        !isMountedRef.current ||
        audioDeviceLoadRequestIdRef.current !== requestId
      ) {
        return undefined;
      }

      try {
        const devices = await window.electron.managedRecorder.listAudioDevices({
          forceRefresh,
        });
        if (
          isMountedRef.current &&
          audioDeviceLoadRequestIdRef.current === requestId
        ) {
          setAudioDevices(devices);
          setAudioDeviceLoadStatus("loaded");
        }
      } catch {
        if (
          isMountedRef.current &&
          audioDeviceLoadRequestIdRef.current === requestId
        ) {
          setAudioDeviceLoadStatus("failed");
        }
      }

      return undefined;
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadAudioDevices();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadAudioDevices]);

  const handleAudioDevicesRefresh = () => {
    void loadAudioDevices(true);
  };
  const handleAudioInputChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({
      recordingAudioInputDeviceId: resolveAudioDeviceValue(
        audioInputOptions,
        event.target.value,
      ),
    });
  };
  const handleAudioOutputChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void updateSettings({
      recordingAudioOutputDeviceId: resolveAudioDeviceValue(
        audioOutputOptions,
        event.target.value,
      ),
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">Audio Settings</h2>
        <button
          aria-label="Refresh audio devices"
          className="btn btn-ghost btn-xs h-7 min-h-0 w-7 p-0 text-primary"
          disabled={isRecording || isBusy || isLoadingAudioDevices}
          title={audioDevicesRefreshTitle}
          type="button"
          onClick={handleAudioDevicesRefresh}
        >
          <FiRefreshCw
            className={clsx("h-3.5 w-3.5", {
              "animate-spin": isLoadingAudioDevices,
            })}
          />
        </button>
      </div>

      {showAudioDeviceLoadingState && (
        <ManagedRecorderAudioDeviceLoadingState />
      )}
      {showAudioDeviceErrorState && <ManagedRecorderAudioDeviceErrorState />}
      {!showAudioDeviceLoadingState && !showAudioDeviceErrorState && (
        <ManagedRecorderAudioDeviceSelects
          audioInputOptions={audioInputOptions}
          audioInputValue={audioInputValue}
          audioOutputOptions={audioOutputOptions}
          audioOutputValue={audioOutputValue}
          disabled={isRecording || isBusy}
          onAudioInputChange={handleAudioInputChange}
          onAudioOutputChange={handleAudioOutputChange}
        />
      )}
    </div>
  );
}

export { ManagedRecorderAudioSettingsCard };
