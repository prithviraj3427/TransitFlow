import type { ReactNode } from "react";

/** Card skeleton with a shimmer sweep. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mb-3 rounded-3xl border border-line bg-surface p-4" aria-hidden>
      <div className="mb-4 flex items-center justify-between">
        <Shimmer className="h-8 w-16" />
        <Shimmer className="h-6 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="mb-2.5 h-3.5" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

function Shimmer({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-full bg-surface-2 ${className}`} style={style}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-line to-transparent animate-shimmer" />
    </div>
  );
}

/** Generic empty state with an icon slot. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-[15px] font-extrabold tracking-tight">{title}</h3>
      {body && <p className="mt-1.5 max-w-[280px] text-[13px] font-medium leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Small pill badge with tone variants. */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "good" | "bad" | "warn";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-surface-2 text-muted",
    brand: "border-transparent bg-brand-soft text-brand-ink",
    good: "border-transparent bg-good-soft text-good-ink",
    bad: "border-transparent bg-bad-soft text-bad-ink",
    warn: "border-transparent bg-warn-soft text-warn-ink",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}
