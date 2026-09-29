"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bus, Camera, Cpu, Radar, ShieldCheck } from "lucide-react";
import { getMeta } from "@/lib/api";
import type { Meta } from "@/lib/types";
import { Logo } from "@/components/Shell";

export default function AboutPage() {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  return (
    <div className="animate-fade-up space-y-4">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center gap-3">
          <Logo className="h-11 w-11" />
          <div>
            <h1 className="text-[19px] font-black tracking-tight">TransitFlow</h1>
            <p className="text-[12px] font-bold text-muted">Ghost-bus radar · v{meta?.version ?? "1.0.0"}</p>
          </div>
        </div>
        <p className="text-[13.5px] font-medium leading-relaxed text-ink/80">
          In many cities, a bus&apos;s windshield sticker and its LED display don&apos;t always agree.
          TransitFlow turns your camera into a route checker: AI reads both numbers, the server makes the
          call, and riders nearby get a live warning — before they board the wrong bus.
        </p>
      </div>

      <div>
        <h2 className="mb-2.5 px-1 text-[11px] font-extrabold uppercase tracking-wider text-muted">How it works</h2>
        <ol className="space-y-2.5">
          <StepCard
            step="1"
            icon={<Camera className="h-5 w-5" />}
            title="Scan"
            body="Photograph the bus windshield — the red circular sticker and the LED destination display."
          />
          <StepCard
            step="2"
            icon={<Cpu className="h-5 w-5" />}
            title="Verify"
            body={`Gemini Vision reads both route numbers; the server compares them and decides MATCH or MISMATCH. You can correct any reading.`}
          />
          <StepCard
            step="3"
            icon={<Radar className="h-5 w-5" />}
            title="Warn"
            body="Mismatches publish to the live radar with the stop and GPS attached. Alerts auto-expire so the feed stays current."
          />
        </ol>
      </div>

      <div className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-extrabold tracking-tight">
          <ShieldCheck className="h-4 w-4 text-brand" /> Under the hood
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <MetaCell label="AI model" value={meta?.model ?? "—"} />
          <MetaCell label="Storage" value={meta?.storage === "redis" ? "Redis (durable)" : "In-memory"} />
          <MetaCell label="Routes in dataset" value={String(meta?.routesInDataset ?? "—")} />
          <MetaCell label="Alert lifetime" value={meta ? `${meta.alertTtlMinutes} min` : "—"} />
        </dl>
      </div>

      <div className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="mb-2 text-[13px] font-extrabold tracking-tight">Built by</h2>
        <p className="text-[13px] font-semibold text-ink/80">
          Senthilnathan S. &amp; Prithviraj Y. Patel — <span className="text-muted">impact.exe</span> · buildathon project
        </p>
        <p className="mt-3 text-[11.5px] font-medium leading-relaxed text-muted">
          TransitFlow is a community tool for awareness. Always double-check the bus yourself before boarding —
          route datasets change, and no AI is perfect.
        </p>
      </div>

      <Link
        href="/scan"
        className="flex items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[14px] font-bold text-white active:scale-[0.98]"
      >
        <Bus className="h-4 w-4" /> Start scanning
      </Link>
    </div>
  );
}

function StepCard({ step, icon, title, body }: { step: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</span>
      <div>
        <p className="text-[13.5px] font-extrabold tracking-tight">
          <span className="mr-1.5 text-brand">{step}.</span>
          {title}
        </p>
        <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-bold">{value}</dd>
    </div>
  );
}
