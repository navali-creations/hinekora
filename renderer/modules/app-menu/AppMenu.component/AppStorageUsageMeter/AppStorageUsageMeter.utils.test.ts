import { describe, expect, it } from "vitest";

import {
  calculateDiskBoundUsagePercentage,
  calculateStorageUsagePercentage,
  formatStorageGigabytes,
} from "./AppStorageUsageMeter.utils";

const GIGABYTE = 1024 ** 3;

describe("AppStorageUsageMeter utils", () => {
  it("formats storage in compact gigabyte values", () => {
    expect(formatStorageGigabytes(0)).toBe("0 GB");
    expect(formatStorageGigabytes(0.34 * GIGABYTE)).toBe("0.3 GB");
    expect(formatStorageGigabytes(48 * GIGABYTE)).toBe("48 GB");
  });

  it("clamps finite configured-limit percentages", () => {
    expect(calculateStorageUsagePercentage(12 * GIGABYTE, 48)).toBe(25);
    expect(calculateStorageUsagePercentage(60 * GIGABYTE, 48)).toBe(100);
    expect(calculateStorageUsagePercentage(12 * GIGABYTE, 0)).toBe(0);
  });

  it("calculates usage against the capacity available on the recording disk", () => {
    expect(
      calculateDiskBoundUsagePercentage(11 * GIGABYTE, 89 * GIGABYTE),
    ).toBe(11);
    expect(calculateDiskBoundUsagePercentage(12 * GIGABYTE, 0)).toBe(100);
    expect(calculateDiskBoundUsagePercentage(0, 100 * GIGABYTE)).toBe(0);
    expect(calculateDiskBoundUsagePercentage(12 * GIGABYTE, null)).toBe(0);
  });
});
