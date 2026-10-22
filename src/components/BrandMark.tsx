import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-primary text-primary-foreground shadow-soft",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" className="size-6">
        <path
          d="M25.5 5.5c-6.6.2-10.2 3.4-10.2 8.4 0 2.4 1.3 4.2 3.6 4.2 4.5 0 6.4-4.6 6.6-12.6Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M6.5 26.5c.3-6.2 3.5-9.7 8.3-9.7 2.3 0 4 1.2 4 3.4 0 4.4-4.7 6.3-12.3 6.3Z"
          fill="currentColor"
          opacity="0.62"
        />
        <path
          d="M13.2 22.1c1.5-3.1 4.4-5.5 8.2-7.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className={compact ? "size-9" : undefined} />
      <div className="min-w-0">
        <p className="truncate font-display text-[1.2rem] font-semibold leading-none tracking-[-0.025em]">
          BatteryBloom
        </p>
        {!compact ? (
          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Calm battery care
          </p>
        ) : null}
      </div>
    </div>
  );
}
