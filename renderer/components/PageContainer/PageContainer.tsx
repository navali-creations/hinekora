import clsx from "clsx";
import type { PropsWithChildren } from "react";

interface PageContainerProps extends PropsWithChildren {
  className?: string;
}

function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div
      className={clsx(
        "flex h-[calc(100%_-_calc(var(--spacing)_*_10))] min-h-0 flex-col gap-6 bg-base-100 p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { PageContainer };
