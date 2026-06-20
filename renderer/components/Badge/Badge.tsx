import clsx from "clsx";
import type { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "ghost";

type BadgeSize = "xs" | "sm" | "md" | "lg";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  soft?: boolean;
  className?: string;
  icon?: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "badge-neutral",
  primary: "badge-primary",
  secondary: "badge-secondary",
  accent: "badge-accent",
  info: "badge-info",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  ghost: "badge-ghost",
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: "badge-xs",
  sm: "badge-sm",
  md: "badge-md",
  lg: "badge-lg",
};

function Badge({
  children,
  variant = "default",
  size = "sm",
  outline = false,
  soft = false,
  className,
  icon,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "badge gap-1 font-normal",
        variantClasses[variant],
        sizeClasses[size],
        {
          "badge-outline": outline,
          "badge-soft": soft,
        },
        className,
      )}
    >
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      {children}
    </span>
  );
}

export { Badge };
