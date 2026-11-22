"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS: { value: "system" | "light" | "dark"; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const subscribe = () => () => {};
/** True after hydration (the stored theme is only known on the client). */
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** Settings → Appearance: System / Light / Dark segmented control + preview tiles. */
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? "system") : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Theme"
        className="bg-track grid grid-cols-3 gap-1 rounded-xl p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const checked = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setTheme(value)}
              className={cn(
                "focus-visible:ring-ring/50 flex h-11 items-center justify-center gap-2 rounded-lg text-sm outline-none focus-visible:ring-3",
                checked
                  ? "bg-card text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3" aria-hidden>
        <PreviewTile themeClass="light" name="Cream" active={current === "light"} />
        <PreviewTile themeClass="dark" name="Navy" active={current === "dark"} />
      </div>
    </div>
  );
}

/** Miniature screen painted with one theme's tokens, whatever the current theme is. */
function PreviewTile({
  themeClass,
  name,
  active,
}: {
  themeClass: "light" | "dark";
  name: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        themeClass,
        "bg-background text-foreground flex flex-col gap-2 rounded-xl border p-3",
        active ? "border-brass ring-brass ring-1" : "border-border-strong",
      )}
    >
      <div className="flex items-center gap-1">
        <span className="font-display text-xs font-bold">LangLearner</span>
        <span className="bg-brass size-1.5 rounded-full" />
      </div>
      <div className="bg-hero flex items-center gap-2 rounded-lg p-2">
        <span className="border-hero-brass size-5 rounded-full border-[3px]" />
        <span className="bg-on-hero/70 h-1.5 flex-1 rounded-full" />
      </div>
      <div className="bg-card flex flex-col gap-1 rounded-lg p-2">
        <span className="bg-track h-1.5 rounded-full">
          <span className="bg-level-2 block h-full w-2/3 rounded-full" />
        </span>
        <span className="bg-track h-1.5 rounded-full">
          <span className="bg-level-0 block h-full w-1/3 rounded-full" />
        </span>
      </div>
      <span className="text-muted-foreground text-xs">{name}</span>
    </div>
  );
}
