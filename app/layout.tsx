import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_COLOR } from "./manifest";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
