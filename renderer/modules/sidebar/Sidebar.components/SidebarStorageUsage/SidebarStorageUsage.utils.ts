import { storageBytesPerGigabyte } from "~/types";

function formatStorageGigabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 GB";
  }
  const value = Math.round((bytes / storageBytesPerGigabyte) * 10) / 10;
  return `${value} GB`;
}

function calculateStorageUsagePercentage(
  usedBytes: number,
  limitGigabytes: number,
): number {
  if (
    !Number.isFinite(usedBytes) ||
    usedBytes <= 0 ||
    !Number.isFinite(limitGigabytes) ||
    limitGigabytes <= 0
  ) {
    return 0;
  }
  return Math.min(
    100,
    (usedBytes / (limitGigabytes * storageBytesPerGigabyte)) * 100,
  );
}

export { calculateStorageUsagePercentage, formatStorageGigabytes };
