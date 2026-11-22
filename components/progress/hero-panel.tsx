import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The one inverted panel per screen (hero / on-hero); holds the primary CTA. */
export function HeroPanel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="hero-panel"
      className={cn("bg-hero text-on-hero rounded-3xl p-5 md:p-6", className)}
      {...props}
    />
  );
}
