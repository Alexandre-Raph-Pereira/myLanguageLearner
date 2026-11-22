import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ring drawn with a CSS conic-gradient masked to a band (no SVG).
 * `color` / `track` are CSS colour values (use token variables).
 */
export function Ring({
  pct,
  color,
  track,
  thickness,
  className,
  style,
  children,
}: {
  pct: number;
  color: string;
  track: string;
  thickness: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const p = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  const band: CSSProperties = {
    background: `conic-gradient(${color} ${p}%, ${track} 0)`,
    mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness - 0.5}px))`,
  };
  return (
    <div className={cn("relative rounded-full", className)} style={style}>
      <div aria-hidden className="absolute inset-0 rounded-full" style={band} />
      {children}
    </div>
  );
}
