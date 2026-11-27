// Fingerprints the card art so a repaint shows up at once. Browsers keep
// /art/* for a day and then show the old copy while re-checking (see
// vercel.json), so a picture repainted under the same name could stay stale
// for days. Each court folder and the backs folder get a short hash of their
// contents; the app adds it to the picture's address (?v=…), so changed art
// is a new address and loads fresh.
//
// Runs before every build (package.json "prebuild"). Writes
// src/data/artVersions.json: { "court/<set>": hash, "court/<set>/<tone>": hash, "backs": hash }.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const art = path.join(root, 'public/art')

function hashDir(dir) {
  const h = createHash('sha1')
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()) {
    h.update(f)
    h.update(fs.readFileSync(path.join(dir, f)))
  }
  return h.digest('hex').slice(0, 8)
}

const versions = { backs: hashDir(path.join(art, 'backs')) }
const court = path.join(art, 'court')
for (const set of fs.readdirSync(court).sort()) {
  const dir = path.join(court, set)
  if (!fs.statSync(dir).isDirectory()) continue
  versions[`court/${set}`] = hashDir(dir)
  for (const tone of fs.readdirSync(dir).sort()) {
    if (fs.statSync(path.join(dir, tone)).isDirectory()) versions[`court/${set}/${tone}`] = hashDir(path.join(dir, tone))
  }
}

const out = path.join(root, 'src/data/artVersions.json')
const next = `${JSON.stringify(versions, null, 1)}\n`
if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== next) fs.writeFileSync(out, next)
console.log(`art versions: ${Object.keys(versions).length} folders`)
