import clsx from "clsx";
import type { PropsWithChildren } from "react";

interface PageContentProps extends PropsWithChildren {
  className?: string;
}

function PageContent({ children, className = "" }: PageContentProps) {
  return (
    <div
      className={clsx(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { PageContent };
