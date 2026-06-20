import clsx from "clsx";

interface StatusPillProps {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-bold text-xs",
        {
          "bg-success text-success-content": tone === "good",
          "bg-warning text-warning-content": tone === "warn",
          "bg-error text-error-content": tone === "bad",
          "bg-primary/40 text-primary-content": tone === "neutral",
        },
      )}
    >
      {label}
    </span>
  );
}

export { StatusPill };
