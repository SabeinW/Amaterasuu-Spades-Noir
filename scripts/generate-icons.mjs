import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Regenerates apple-touch-icon.png / icon-192.png / icon-512.png /
// icon-maskable-512.png from public/favicon.svg. Run this after editing the
// logo SVG so the browser favicon, iOS home-screen icon, and PWA manifest
// icons all stay in sync with the same source design.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const svgPath = path.join(publicDir, 'favicon.svg')
const svg = fs.readFileSync(svgPath, 'utf8')

// iOS home screen icons must be fully opaque (no alpha) — Safari fills any
// transparency with black, which would clip the rounded corners as a black
// square. Apple also applies its own corner-rounding mask on add-to-home-screen,
// so this source render intentionally stays a plain (unrounded) filled square;
// the SVG's own rx=22 rounding is for in-browser/manifest use only.
const squareSvg = svg.replace('rx="22"', 'rx="0"')

const targets = [
  { file: 'apple-touch-icon.png', size: 180, square: true },
  { file: 'icon-192.png', size: 192, square: false },
  { file: 'icon-512.png', size: 512, square: false },
  { file: 'icon-maskable-512.png', size: 512, square: true }, // maskable: safe-zone padding, no transparency
]

const browser = await chromium.launch()
const page = await browser.newPage()

for (const t of targets) {
  const markup = t.square ? squareSvg : svg
  const isMaskable = t.file.includes('maskable')
  const paddingPct = isMaskable ? 12 : 0 // maskable icons need ~safe-zone padding
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`
    <html><body style="margin:0;padding:0;width:${t.size}px;height:${t.size}px;display:flex;align-items:center;justify-content:center;background:${isMaskable ? 'linear-gradient(135deg,#a78bfa,#38bdf8)' : 'transparent'};">
      <div style="width:${t.size - (paddingPct * 2 * t.size) / 100}px;height:${t.size - (paddingPct * 2 * t.size) / 100}px;">
        ${markup.replace('<svg ', `<svg width="100%" height="100%" `)}
      </div>
    </body></html>
  `)
  await page.waitForTimeout(50)
  await page.screenshot({ path: path.join(publicDir, t.file), omitBackground: !t.square && !isMaskable })
  console.log(`wrote ${t.file} (${t.size}x${t.size})`)
}

await browser.close()
