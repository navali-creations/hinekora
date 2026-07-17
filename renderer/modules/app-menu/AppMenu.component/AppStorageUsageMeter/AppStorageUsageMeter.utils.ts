const BYTES_PER_GIGABYTE = 1024 ** 3;

function formatStorageGigabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 GB";
  }

  const roundedGigabytes = Math.round((bytes / BYTES_PER_GIGABYTE) * 10) / 10;

  return `${roundedGigabytes} GB`;
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
    (usedBytes / (limitGigabytes * BYTES_PER_GIGABYTE)) * 100,
  );
}

function calculateDiskBoundUsagePercentage(
  usedBytes: number,
  diskFreeBytes: number | null,
): number {
  if (
    !Number.isFinite(usedBytes) ||
    usedBytes <= 0 ||
    diskFreeBytes === null ||
    !Number.isFinite(diskFreeBytes) ||
    diskFreeBytes < 0
  ) {
    return 0;
  }

  return Math.min(100, (usedBytes / (usedBytes + diskFreeBytes)) * 100);
}

export {
  calculateDiskBoundUsagePercentage,
  calculateStorageUsagePercentage,
  formatStorageGigabytes,
};
