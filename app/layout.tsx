import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Noto_Serif_KR } from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_COLOR } from "./manifest";
import "./globals.css";

// Font CSS variables are mapped to Tailwind's font-sans / font-display / font-target-ko in globals.css.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});
// Large CJK font: not preloaded, swapped in when Korean text appears.
const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  weight: ["500", "700"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "LangLearner",
  description: "Personal language learning: words, grammar and TOPIK practice.",
  applicationName: "LangLearner",
  appleWebApp: { capable: true, title: "LangLearner", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  // Next emits `mobile-web-app-capable`; older iOS versions still read the apple-prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets content use env(safe-area-inset-*)
  themeColor: THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${notoSerifKr.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
