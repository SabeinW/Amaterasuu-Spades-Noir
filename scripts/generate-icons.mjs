import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Renders every app icon from one 1024x1024 full-bleed master,
// scripts/art/icon-master.png (the gold-leaf sun with the black spade).
//
//   apple-touch-icon.png   180  iOS home screen and macOS Safari "Add to Dock".
//                               Fully opaque and square: Apple rounds the corners
//                               itself, and fills any transparency with black.
//   icon-maskable-512.png  512  Android/Chrome maskable icon: opaque, full bleed
//                               (the master keeps its art inside the safe zone).
//   icon-192/512.png            Manifest "any" icons: pre-rounded corners with a
//                               transparent outside, for desktop installs.
//   favicon-32/16.png           Browser tab.
//
// Run after replacing the master:
//   CHROMIUM_PATH=/usr/bin/google-chrome node scripts/generate-icons.mjs

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const master = fs.readFileSync(path.join(__dirname, 'art', 'icon-master.png')).toString('base64')

const targets = [
  { file: 'apple-touch-icon.png', size: 180, round: false },
  { file: 'icon-maskable-512.png', size: 512, round: false },
  { file: 'icon-192.png', size: 192, round: true },
  { file: 'icon-512.png', size: 512, round: true },
  { file: 'favicon-32.png', size: 32, round: true },
  { file: 'favicon-16.png', size: 16, round: true },
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()

for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`
    <html><body style="margin:0;background:transparent">
      <img src="data:image/png;base64,${master}" style="display:block;width:${t.size}px;height:${t.size}px;border-radius:${t.round ? '22.37%' : '0'}" />
    </body></html>
  `)
  await page.waitForFunction(() => document.images[0].complete)
  await page.screenshot({ path: path.join(publicDir, t.file), omitBackground: t.round })
  console.log(`wrote ${t.file} (${t.size}x${t.size})`)
}

await browser.close()
