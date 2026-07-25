import { describe, expect, it } from "vitest";

import {
  calculateStorageUsagePercentage,
  formatStorageGigabytes,
} from "./SidebarStorageUsage.utils";

describe("SidebarStorageUsage utilities", () => {
  it("formats bounded gigabyte values", () => {
    expect(formatStorageGigabytes(0)).toBe("0 GB");
    expect(formatStorageGigabytes(Number.NaN)).toBe("0 GB");
    expect(formatStorageGigabytes(1.25 * 1024 ** 3)).toBe("1.3 GB");
  });

  it("calculates capped budget percentages", () => {
    expect(calculateStorageUsagePercentage(5 * 1024 ** 3, 10)).toBe(50);
    expect(calculateStorageUsagePercentage(20 * 1024 ** 3, 10)).toBe(100);
    expect(calculateStorageUsagePercentage(1, 0)).toBe(0);
    expect(calculateStorageUsagePercentage(Number.NaN, 10)).toBe(0);
  });
});
