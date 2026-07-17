import { describe, expect, it } from "vitest";

import {
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

  it("clamps finite storage percentages and handles unlimited storage", () => {
    expect(calculateStorageUsagePercentage(12 * GIGABYTE, 48)).toBe(25);
    expect(calculateStorageUsagePercentage(60 * GIGABYTE, 48)).toBe(100);
    expect(calculateStorageUsagePercentage(12 * GIGABYTE, 0)).toBe(0);
  });
});
