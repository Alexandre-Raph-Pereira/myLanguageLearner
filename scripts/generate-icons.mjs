// Generates placeholder PWA icons into public/ by rendering an SVG with Playwright.
// Usage: node scripts/generate-icons.mjs   (the owner may replace the PNGs later)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BG = "#18181b";
const FG = "#fafafa";
const ACCENT = "#f43f5e";

/** maskable: glyph kept inside the 80% safe zone and the background fills the square. */
function svg(size, { maskable = false, rounded = true } = {}) {
  const radius = rounded && !maskable ? size * 0.22 : 0;
  const scale = maskable ? 0.62 : 0.78;
  const font = size * 0.5 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.36 * scale}" fill="none" stroke="${ACCENT}" stroke-width="${size * 0.035 * scale}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="'Noto Sans KR','WenQuanYi Zen Hei',sans-serif" font-weight="700"
        font-size="${font}" fill="${FG}">한</text>
</svg>`;
}

const ICONS = [
  { file: "icons/icon-192.png", size: 192 },
  { file: "icons/icon-512.png", size: 512 },
  { file: "icons/icon-maskable-192.png", size: 192, maskable: true },
  { file: "icons/icon-maskable-512.png", size: 512, maskable: true },
  // iOS applies its own corner mask: square, no transparency.
  { file: "apple-touch-icon.png", size: 180, rounded: false },
];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(icon.size, icon)}</body></html>`,
  );
  await page.screenshot({
    path: path.join(root, "public", icon.file),
    omitBackground: !icon.maskable && icon.rounded !== false,
    clip: { x: 0, y: 0, width: icon.size, height: icon.size },
  });
  console.log("wrote", icon.file);
}
await browser.close();
