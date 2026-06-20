export const CORE_MAINTAINERS = new Set(["sbsrnt"]);

export type ChangeTypeColor = "info" | "success" | "warning" | "accent";

const releasesBaseUrl =
  "https://github.com/navali-creations/hinekora/releases/tag";

const hoverBorderClasses: Record<ChangeTypeColor, string> = {
  info: "hover:border-info",
  success: "hover:border-success",
  warning: "hover:border-warning",
  accent: "hover:border-accent",
};

export function changeTypeColor(changeType: string): ChangeTypeColor {
  const lower = changeType.toLowerCase();

  if (lower.includes("minor")) {
    return "success";
  }
  if (lower.includes("major")) {
    return "warning";
  }
  if (lower.includes("patch")) {
    return "info";
  }

  return "accent";
}

export function hoverBorderColorClass(color: ChangeTypeColor): string {
  return hoverBorderClasses[color];
}

export function releaseUrl(version: string): string {
  return `${releasesBaseUrl}/v${version}`;
}
