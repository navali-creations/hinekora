import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  subtitle?: ReactNode;
}

function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-baseline justify-between gap-6">
      <div className="flex min-w-0 flex-col">
        <h1 className="m-0 font-bold text-3xl text-base-content leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 text-base text-base-content/70 leading-normal">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

export { PageHeader };
