"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Pencil, Plus, ShieldCheck, Sun, Trash2, User } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/Toast";

const NAME_KEY = "transitflow:name";
const FAV_KEY = "transitflow:favorite-routes";

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState("Commuter");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [routeDraft, setRouteDraft] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem(NAME_KEY);
      if (storedName) setName(storedName);
      const storedFavs = window.localStorage.getItem(FAV_KEY);
      if (storedFavs) setFavorites(JSON.parse(storedFavs));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function saveName() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setName(trimmed);
    setEditing(false);
    try {
      window.localStorage.setItem(NAME_KEY, trimmed);
    } catch {
      /* ignore */
    }
    showToast("success", "Profile updated.");
  }

  function addFavorite() {
    const value = routeDraft.trim().toUpperCase();
    if (!value) return;
    if (favorites.includes(value)) {
      setRouteDraft("");
      showToast("info", `${value} is already a favorite.`);
      return;
    }
    const next = [...favorites, value];
    setFavorites(next);
    setRouteDraft("");
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function removeFavorite(route: string) {
    const next = favorites.filter((r) => r !== route);
    setFavorites(next);
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  if (!ready) return null;

  return (
    <div className="animate-fade-up space-y-4">
      {/* Identity card */}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div className="h-20 bg-gradient-to-br from-[#4F46E5] via-[#6D28D9] to-[#7C3AED]" />
        <div className="-mt-8 px-5 pb-5">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-surface bg-brand-soft text-brand-ink">
            <User className="h-7 w-7" strokeWidth={2.2} />
          </div>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
                className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] font-bold focus:border-brand"
              />
              <button
                onClick={saveName}
                className="rounded-xl bg-brand px-4 text-[12.5px] font-bold text-white active:scale-95"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[17px] font-black tracking-tight">{name}</h1>
                <p className="text-[12px] font-semibold text-muted">Community scout</p>
              </div>
              <button
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-[12px] font-bold text-muted hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-muted">Appearance</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <ThemeButton
            active={theme === "light"}
            onClick={() => setTheme("light")}
            label="Light"
            icon={<Sun className="h-4 w-4" />}
          />
          <ThemeButton
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            label="Dark"
            icon={<Moon className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Favorites */}
      <div className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-muted">Favorite routes</h2>
        <div className="mb-3 flex gap-2">
          <input
            value={routeDraft}
            onChange={(e) => setRouteDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFavorite()}
            placeholder="Add a route, e.g. 102A"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px] font-semibold placeholder:font-medium placeholder:text-muted focus:border-brand"
          />
          <button
            onClick={addFavorite}
            disabled={!routeDraft.trim()}
            className="flex items-center gap-1 rounded-xl bg-brand px-3.5 text-[12px] font-bold text-white disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Add
          </button>
        </div>
        {favorites.length === 0 ? (
          <p className="text-[12px] font-medium text-muted">
            No favorites yet — star the routes you ride every day from the Routes tab.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {favorites.map((route) => (
              <span
                key={route}
                className="flex items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1.5 text-[12px] font-extrabold"
              >
                {route}
                <button
                  onClick={() => removeFavorite(route)}
                  aria-label={`Remove ${route}`}
                  className="text-muted hover:text-bad"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="flex items-start gap-3 rounded-3xl border border-line bg-surface p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <p className="text-[13px] font-extrabold tracking-tight">TransitFlow v1.0</p>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-muted">
            Built by Senthilnathan S. &amp; Prithviraj Y. Patel (impact.exe).{" "}
            <Link href="/about" className="font-bold text-brand-ink">
              How it works →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-[13px] font-bold transition-colors ${
        active ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-bg text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
