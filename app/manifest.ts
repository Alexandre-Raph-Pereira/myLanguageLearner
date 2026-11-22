import type { MetadataRoute } from "next";
import { THEME_META } from "@/lib/design/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LangLearner — personal language learning",
    short_name: "LangLearner",
    description: "Words, grammar and TOPIK practice built from your own library.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_META.manifestBackground,
    theme_color: THEME_META.manifestTheme,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
