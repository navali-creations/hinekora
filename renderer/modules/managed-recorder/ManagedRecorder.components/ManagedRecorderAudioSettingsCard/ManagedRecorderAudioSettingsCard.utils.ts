import type { ManagedRecorderAudioDevice } from "~/main/modules/managed-recorder/ManagedRecorder.dto";

const audioDisabledValue = "__disabled__";
const audioDeviceLabelMaxLength = 20;

interface AudioDeviceOptionInput {
  devices: ManagedRecorderAudioDevice[];
  disabledLabel: string;
  defaultLabel: string;
}

interface AudioDeviceOption {
  value: string;
  deviceId: string | null;
  label: string;
  title: string;
}

function createAudioDeviceOptions({
  devices,
  disabledLabel,
  defaultLabel,
}: AudioDeviceOptionInput): AudioDeviceOption[] {
  const options: AudioDeviceOption[] = [
    {
      value: audioDisabledValue,
      deviceId: null,
      label: disabledLabel,
      title: disabledLabel,
    },
    {
      value: "default",
      deviceId: "default",
      label: defaultLabel,
      title: defaultLabel,
    },
  ];
  const seenDeviceLabels = new Set<string>();
  let deviceOptionIndex = 0;

  for (const device of devices) {
    if (device.id === "default") {
      continue;
    }

    const deviceKey = `${device.id}\u0000${device.label}`;
    if (seenDeviceLabels.has(deviceKey)) {
      continue;
    }

    options.push({
      value: `device:${deviceOptionIndex}`,
      deviceId: device.id,
      label: formatAudioDeviceLabel(device.label),
      title: device.label,
    });
    seenDeviceLabels.add(deviceKey);
    deviceOptionIndex += 1;
  }

  return options;
}

function formatAudioDeviceLabel(label: string): string {
  const trimmedLabel = label.trim();
  if (trimmedLabel.length <= audioDeviceLabelMaxLength) {
    return trimmedLabel;
  }

  return `${trimmedLabel.slice(0, audioDeviceLabelMaxLength - 3).trimEnd()}...`;
}

function resolveAudioDeviceValue(
  options: AudioDeviceOption[],
  selectedValue: string,
): string | null {
  return (
    options.find((option) => option.value === selectedValue)?.deviceId ?? null
  );
}

function resolveAudioOptionValue(
  options: AudioDeviceOption[],
  selectedDeviceId: string | null,
): string {
  return (
    options.find((option) => option.deviceId === selectedDeviceId)?.value ??
    audioDisabledValue
  );
}

function resolveAudioOptionTitle(
  options: AudioDeviceOption[],
  selectedValue: string,
): string {
  return (
    options.find((option) => option.value === selectedValue)?.title ??
    selectedValue
  );
}

function waitForAudioDeviceLoadPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export type { AudioDeviceOption };
export {
  audioDisabledValue,
  createAudioDeviceOptions,
  formatAudioDeviceLabel,
  resolveAudioDeviceValue,
  resolveAudioOptionTitle,
  resolveAudioOptionValue,
  waitForAudioDeviceLoadPaint,
};
