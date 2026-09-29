import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: "Radar", icon: (active: boolean) => <RadarIcon active={active} /> },
  { href: "/routes", label: "Routes", icon: (active: boolean) => <RouteIcon active={active} /> },
  { href: "/profile", label: "Profile", icon: (active: boolean) => <ProfileIcon active={active} /> },
];

/**
 * App shell: sticky header + bottom tab bar.
 * The center "Scan" action is a floating action button (the star feature).
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onScan = pathname === "/scan";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="TransitFlow home">
            <Logo className="h-7 w-7" />
            <span className="text-[17px] font-extrabold tracking-tight">
              Transit<span className="text-brand">Flow</span>
            </span>
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-good animate-pulse-ring" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Live</span>
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-4">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-xl safe-bottom"
        aria-label="Primary"
      >
        <div className="mx-auto grid h-16 max-w-[480px] grid-cols-4 items-center px-2">
          <TabButton href={TABS[0].href} label={TABS[0].label} active={pathname === "/"}>
            {TABS[0].icon(true)}
          </TabButton>

          <TabButton href={TABS[1].href} label={TABS[1].label} active={pathname === "/routes"}>
            {TABS[1].icon(true)}
          </TabButton>

          <ScanFab active={onScan} />

          <TabButton href={TABS[2].href} label={TABS[2].label} active={pathname === "/profile"}>
            {TABS[2].icon(true)}
          </TabButton>
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex w-16 flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
        active ? "text-brand" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      <span className={`text-[10px] font-bold tracking-wide ${active ? "" : "text-muted"}`}>{label}</span>
    </Link>
  );
}

function ScanFab({ active }: { active: boolean }) {
  return (
    <Link
      href="/scan"
      aria-label="Scan a bus"
      className="flex flex-col items-center gap-1 py-1.5"
    >
      <span
        className={`flex h-11 w-14 items-center justify-center rounded-2xl transition-all active:scale-95 ${
          active ? "bg-brand-ink text-brand-soft shadow-float" : "bg-brand text-white shadow-card"
        }`}
      >
        <CameraGlyph />
      </span>
      <span className={`text-[10px] font-bold tracking-wide ${active ? "text-brand" : "text-muted"}`}>Scan</span>
    </Link>
  );
}

/* ── Brand + tab icons (hand-tuned, consistent 24px grid) ─────────── */

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#tf-logo-grad)" />
      <rect x="7" y="9" width="18" height="15" rx="3.5" fill="#fff" fillOpacity="0.96" />
      <rect x="9.5" y="11.5" width="13" height="6" rx="1.8" fill="#312e81" fillOpacity="0.85" />
      <circle cx="11" cy="21" r="1.7" fill="#fbbf24" />
      <circle cx="21" cy="21" r="1.7" fill="#fbbf24" />
      <defs>
        <linearGradient id="tf-logo-grad" x1="1" y1="1" x2="31" y2="31">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function CameraGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-6 w-6" aria-hidden>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a2 2 0 0 0 1.6-.8l.5-.7a2 2 0 0 1 1.6-.8h1.8a2 2 0 0 1 1.6.8l.5.7a2 2 0 0 0 1.6.8h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

function RadarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeOpacity={active ? 1 : 0.5} />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeOpacity={active ? 0.8 : 0.35} />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

function RouteIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]" aria-hidden>
      <circle cx="6" cy="19" r="2.4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} />
      <circle cx="18" cy="5" r="2.4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8} />
      <path d="M8 17.5C12 15 8.5 9.5 15.5 7" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeDasharray="0.1 3.4" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]" aria-hidden>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
      <path d="M5 19.5c1.2-3 4-4.5 7-4.5s5.8 1.5 7 4.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" />
    </svg>
  );
}
