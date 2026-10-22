import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between lg:mb-8",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.5rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
