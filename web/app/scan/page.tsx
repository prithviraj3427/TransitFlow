"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  Keyboard,
  Loader2,
  LocateFixed,
  MapPin,
  RotateCcw,
  Share,
  ShieldCheck,
} from "lucide-react";
import {
  ApiError,
  getStops,
  reportFromScan,
  reportManual,
  scanImage,
} from "@/lib/api";
import type { ReportResponse, ScanResult } from "@/lib/types";
import { blobToBase64, compressImage } from "@/lib/format";
import { Badge, EmptyState } from "@/components/Primitives";
import { useToast } from "@/components/Toast";

type Step = "capture" | "analyzing" | "result" | "done";
type Mode = "photo" | "manual";

interface Readings {
  stickerRoute: string | null;
  ledRoute: string | null;
  confidence: string;
  note?: string;
}

export default function ScanPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("capture");
  const [mode, setMode] = useState<Mode>("photo");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [readings, setReadings] = useState<Readings | null>(null);

  // Manual mode inputs
  const [manualSticker, setManualSticker] = useState("");
  const [manualLed, setManualLed] = useState("");

  // Location
  const [stop, setStop] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load stops for autocomplete.
  useEffect(() => {
    getStops(500).then((res) => setStops(res.stops)).catch(() => undefined);
  }, []);

  // ── Camera lifecycle ────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (step !== "capture" || mode !== "photo") {
      stopCamera();
      return;
    }
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        // Camera blocked/unavailable — the gallery fallback below still works.
      }
    }
    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step, mode, stopCamera]);

  function reset() {
    setStep("capture");
    setPreviewUrl(null);
    setImageBlob(null);
    setScan(null);
    setReadings(null);
    setScanError(null);
    setSubmitError(null);
    setReport(null);
    setStop("");
    setGeo(null);
    setManualSticker("");
    setManualLed("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Photo → AI ──────────────────────────────────────────────────────
  async function analyze(blob: Blob) {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return URL.createObjectURL(blob);
    });
    setImageBlob(blob);
    setScanError(null);
    setStep("analyzing");
    setAnalyzing(true);
    try {
      const compressed = await compressImage(blob);
      const base64 = await blobToBase64(compressed);
      const result = await scanImage(base64, "image/jpeg");
      setScan(result);
      setReadings({
        stickerRoute: result.extraction.stickerRoute,
        ledRoute: result.extraction.ledRoute,
        confidence: result.extraction.confidence,
        note: result.extraction.note,
      });
      setStep("result");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Couldn't analyze that photo. Please try again.";
      setScanError(message);
      setStep("capture");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("error", "Please choose an image file.");
      return;
    }
    analyze(file);
  }

  // ── Manual mode ─────────────────────────────────────────────────────
  function manualContinue() {
    const sticker = manualSticker.trim();
    const led = manualLed.trim();
    if (!sticker || !led) {
      showToast("error", "Enter both route numbers to continue.");
      return;
    }
    setReadings({ stickerRoute: sticker.toUpperCase(), ledRoute: led.toUpperCase(), confidence: "MANUAL" });
    setScan(null);
    setStep("result");
  }

  // ── Location ────────────────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) {
      showToast("error", "Location isn't available on this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        showToast("success", "Your location will be attached to the report.");
      },
      () => {
        setLocating(false);
        showToast("error", "Couldn't get your location — enter the stop manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // ── Submit ──────────────────────────────────────────────────────────
  async function submit() {
    if (!readings) return;
    const sticker = readings.stickerRoute?.trim() || undefined;
    const led = readings.ledRoute?.trim() || undefined;
    if (!sticker || !led) {
      setSubmitError("Both route numbers are needed. Fill in the blanks above.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      stop: stop.trim() || undefined,
      lat: geo?.lat,
      lng: geo?.lng,
      stickerRoute: sticker,
      ledRoute: led,
    };
    try {
      const res = scan
        ? await reportFromScan(scan.scanId, payload)
        : await reportManual({ stickerRoute: sticker, ledRoute: led, stop: payload.stop, lat: geo?.lat, lng: geo?.lng });
      setReport(res);
      setStep("done");
      showToast(
        res.verdict === "MISMATCH" ? "error" : "success",
        res.verdict === "MISMATCH"
          ? `Mismatch flagged — riders near ${res.matchedStop ?? "that stop"} are warned.`
          : "Route verified. Thanks for scouting!",
      );
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "The report couldn't be submitted. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shareText = report
    ? report.verdict === "MISMATCH"
      ? `⚠️ TransitFlow: bus claiming ${report.alert?.claimedRoute ?? "?"} is actually running ${report.alert?.ghostRoute} near ${report.matchedStop ?? "your area"}. Check before boarding!`
      : `✅ TransitFlow: route ${report.verdict === "MATCH" ? "" : ""}verified near ${report.matchedStop ?? "here"}.`
    : "";

  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-up">
      {/* ── STEP: CAPTURE ── */}
      {(step === "capture" || step === "analyzing") && (
        <>
          <div className="mb-4">
            <h1 className="text-[22px] font-black tracking-tight">Scan a bus</h1>
            <p className="mt-0.5 text-[13px] font-semibold text-muted">
              Point at the windshield — sticker and LED display both in frame.
            </p>
          </div>

          {scanError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-bad/40 bg-bad-soft p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad-ink" />
              <p className="text-[13px] font-semibold leading-snug text-bad-ink">{scanError}</p>
            </div>
          )}

          <div className="relative mb-4 aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-black shadow-card">
            {step === "capture" && mode === "photo" && (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
              />
            )}
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Captured bus" className="h-full w-full object-cover" />
            )}

            {/* corner frame */}
            {step === "capture" && mode === "photo" && (
              <>
                <Corner position="tl" /> <Corner position="tr" /> <Corner position="bl" /> <Corner position="br" />
                <div className="absolute inset-x-0 top-4 flex justify-center">
                  <span className="rounded-full bg-black/55 px-4 py-1.5 text-[12px] font-bold text-white backdrop-blur">
                    Frame the route placard on the bus
                  </span>
                </div>
              </>
            )}

            {step === "analyzing" && (
              <div className="absolute inset-0 bg-black/60">
                <div className="absolute inset-x-6 h-px bg-gradient-to-r from-transparent via-brand to-transparent animate-scanline shadow-[0_0_18px_2px_rgba(129,140,248,0.8)]" />
                <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  <p className="text-[13px] font-bold text-white">Reading sticker vs. LED display…</p>
                  <p className="text-[11px] font-semibold text-white/60">This usually takes a few seconds</p>
                </div>
              </div>
            )}

            {step === "capture" && mode === "photo" && (
              <div className="absolute inset-x-0 bottom-5 flex items-center justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-4 border-white/90 transition-transform active:scale-95"
                  aria-label="Capture bus photo"
                >
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white">
                    <Camera className="h-6 w-6 text-ink" strokeWidth={2.4} />
                  </span>
                </button>
              </div>
            )}
          </div>

          {step === "capture" && (
            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setMode("manual")}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface py-3.5 text-[12.5px] font-bold text-muted hover:text-ink"
                >
                  <Keyboard className="h-4 w-4" /> No camera? Type it
                </button>
                <a
                  href="/about"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5 text-[12.5px] font-bold text-muted hover:text-ink"
                >
                  How it works <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-line bg-surface/70 p-3.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" /> Scout rules
                </p>
                <ul className="space-y-1 text-[12px] font-medium leading-relaxed text-muted">
                  <li>• Live photo only — it keeps the radar honest.</li>
                  <li>• Photos are analyzed once and never stored.</li>
                  <li>• Reports expire automatically from the radar.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── MANUAL MODE ── */}
          {mode === "manual" && step === "capture" && (
            <div className="mt-4 rounded-3xl border border-line bg-surface p-4">
              <h3 className="mb-3 text-[13px] font-extrabold tracking-tight">Enter the two readings yourself</h3>
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Sticker (claims)</span>
                  <input
                    value={manualSticker}
                    onChange={(e) => setManualSticker(e.target.value)}
                    placeholder="e.g. 102"
                    className="w-full rounded-xl border border-line bg-bg px-3 py-3 text-center text-xl font-black tracking-tight focus:border-brand"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wider text-muted">LED (running)</span>
                  <input
                    value={manualLed}
                    onChange={(e) => setManualLed(e.target.value)}
                    placeholder="e.g. 102A"
                    className="w-full rounded-xl border border-line bg-bg px-3 py-3 text-center text-xl font-black tracking-tight focus:border-brand"
                  />
                </label>
              </div>
              <button
                onClick={manualContinue}
                disabled={!manualSticker.trim() || !manualLed.trim()}
                className="w-full rounded-xl bg-brand py-3 text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          )}
        </>
      )}

      {/* ── STEP: RESULT ── */}
      {step === "result" && readings && (
        <ResultPanel
          readings={readings}
          onReadingsChange={setReadings}
          stop={stop}
          onStopChange={setStop}
          stops={stops}
          geo={geo}
          locating={locating}
          onLocate={useMyLocation}
          submitting={submitting}
          submitError={submitError}
          onSubmit={submit}
          onReset={reset}
          confidence={readings.confidence}
          note={readings.note}
        />
      )}

      {/* ── STEP: DONE ── */}
      {step === "done" && report && (
        <div className="flex flex-col items-center pt-6 text-center">
          <div
            className={`mb-5 flex w-full flex-col items-center rounded-[28px] border-2 p-8 ${
              report.verdict === "MISMATCH" ? "border-bad/50 bg-bad-soft" : "border-good/40 bg-good-soft"
            }`}
          >
            {report.verdict === "MISMATCH" ? (
              <AlertTriangle className="mb-3 h-11 w-11 text-bad-ink" strokeWidth={2.2} />
            ) : (
              <CheckCircle2 className="mb-3 h-11 w-11 text-good-ink" strokeWidth={2.2} />
            )}
            <h2 className="text-[20px] font-black tracking-tight">
              {report.verdict === "MISMATCH" ? "Ghost bus flagged" : "Route verified"}
            </h2>
            <p className="mt-2 max-w-[300px] text-[13.5px] font-semibold leading-relaxed text-ink/80">
              {report.verdict === "MISMATCH"
                ? `A bus claiming ${report.alert?.claimedRoute ?? "?"} is running ${report.alert?.ghostRoute} near ${report.matchedStop ?? "that stop"}. Riders on the radar are warned.`
                : `Route confirmed at ${report.matchedStop ?? "that stop"}. Good scouting!`}
            </p>
          </div>

          {shareText && (
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(shareText).catch(() => undefined);
                  showToast("success", "Share text copied to clipboard.");
                }
              }}
              className="mb-2.5 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[12.5px] font-bold text-ink active:scale-[0.98]"
            >
              <Share className="h-4 w-4 text-muted" /> Copy share text
            </button>
          )}

          <button
            onClick={reset}
            className="w-full rounded-2xl bg-brand py-3.5 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4" /> Scan another bus
            </span>
          </button>
          <Link href="/" className="mt-3 text-[12.5px] font-bold text-muted hover:text-ink">
            Back to the radar
          </Link>
        </div>
      )}
    </div>
  );
}

function Corner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute h-7 w-7 border-white/80";
  const map = {
    tl: "left-4 top-4 rounded-tl-2xl border-l-[3px] border-t-[3px]",
    tr: "right-4 top-4 rounded-tr-2xl border-r-[3px] border-t-[3px]",
    bl: "bottom-4 left-4 rounded-bl-2xl border-b-[3px] border-l-[3px]",
    br: "bottom-4 right-4 rounded-br-2xl border-b-[3px] border-r-[3px]",
  }[position];
  return <span className={`${base} ${map}`} aria-hidden />;
}

/* ── Result panel: verdict + editable readings + location + submit ─── */
function ResultPanel({
  readings,
  onReadingsChange,
  stop,
  onStopChange,
  stops,
  geo,
  locating,
  onLocate,
  submitting,
  submitError,
  onSubmit,
  onReset,
  confidence,
  note,
}: {
  readings: Readings;
  onReadingsChange: (r: Readings) => void;
  stop: string;
  onStopChange: (s: string) => void;
  stops: string[];
  geo: { lat: number; lng: number } | null;
  locating: boolean;
  onLocate: () => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onReset: () => void;
  confidence: string;
  note?: string;
}) {
  const bothFilled = Boolean(readings.stickerRoute?.trim() && readings.ledRoute?.trim());
  const isMatch =
    bothFilled &&
    readings.stickerRoute!.trim().toUpperCase().replace(/\s+/g, "") ===
      readings.ledRoute!.trim().toUpperCase().replace(/\s+/g, "");

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-black tracking-tight">AI reading</h1>
        <Badge tone={confidence === "HIGH" ? "good" : confidence === "MEDIUM" ? "warn" : "brand"}>
          {confidence} confidence
        </Badge>
      </div>

      {/* Verdict preview */}
      <div
        className={`mb-4 flex items-center gap-3 rounded-3xl border-2 p-4 ${
          !bothFilled
            ? "border-warn/40 bg-warn-soft"
            : isMatch
              ? "border-good/40 bg-good-soft"
              : "border-bad/40 bg-bad-soft"
        }`}
      >
        <div className="flex-1">
          {bothFilled && (
            <p className={`text-[14px] font-extrabold leading-snug ${isMatch ? "text-good-ink" : "text-bad-ink"}`}>
              {isMatch ? "Routes match — bus is legit." : `Ghost bus: claims ${readings.stickerRoute} but runs ${readings.ledRoute}.`}
            </p>
          )}
          {!bothFilled && (
            <p className="text-[13.5px] font-bold leading-snug text-warn-ink">
              One reading is missing. Double-check the bus and fill it in below.
            </p>
          )}
          {note && <p className="mt-1 text-[11.5px] font-medium text-muted">{note}</p>}
        </div>
        {!bothFilled ? (
          <AlertTriangle className="h-6 w-6 shrink-0 text-warn-ink" />
        ) : isMatch ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-good-ink" />
        ) : (
          <AlertTriangle className="h-6 w-6 shrink-0 text-bad-ink" />
        )}
      </div>

      {/* Readings (editable) */}
      <div className="mb-4 rounded-3xl border border-line bg-surface p-4">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-muted">
          Route numbers <span className="font-semibold normal-case">— tap to correct the AI</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              Sticker (claims)
            </span>
            <input
              value={readings.stickerRoute ?? ""}
              onChange={(e) => onReadingsChange({ ...readings, stickerRoute: e.target.value || null })}
              placeholder="?"
              className="w-full rounded-xl border border-line bg-bg px-3 py-3 text-center text-xl font-black tracking-tight focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              LED (running)
            </span>
            <input
              value={readings.ledRoute ?? ""}
              onChange={(e) => onReadingsChange({ ...readings, ledRoute: e.target.value || null })}
              placeholder="?"
              className="w-full rounded-xl border border-line bg-bg px-3 py-3 text-center text-xl font-black tracking-tight focus:border-brand"
            />
          </label>
        </div>
      </div>

      {submitError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-bad/40 bg-bad-soft p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad-ink" />
          <p className="text-[13px] font-semibold leading-snug text-bad-ink">{submitError}</p>
        </div>
      )}

      {/* Location */}
      <div className="mb-4 rounded-3xl border border-line bg-surface p-4">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted">Where did you spot it?</p>
        <div className="flex gap-2">
          <input
            list="tf-stops"
            value={stop}
            onChange={(e) => onStopChange(e.target.value)}
            placeholder="e.g. PSG Tech - Peelamedu"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-3 text-[13px] font-semibold placeholder:font-medium placeholder:text-muted focus:border-brand"
          />
          <datalist id="tf-stops">
            {stops.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            onClick={onLocate}
            disabled={locating}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 text-[11.5px] font-bold text-muted disabled:opacity-50"
            aria-label="Use my location"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            GPS
          </button>
        </div>
        {geo && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted">
            <MapPin className="h-3 w-3" /> {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)} attached
          </p>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting || !bothFilled}
        className="w-full rounded-2xl bg-brand py-4 text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
      >
        <span className="flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {submitting ? "Publishing…" : "Publish to the radar"}
        </span>
      </button>
      <button onClick={onReset} className="mt-3 flex w-full items-center justify-center gap-1.5 py-1.5 text-[12px] font-bold text-muted hover:text-ink">
        <RotateCcw className="h-3.5 w-3.5" /> Start over
      </button>
    </div>
  );
}
