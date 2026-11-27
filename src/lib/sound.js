// Real recorded card foley (see public/sounds/SOURCES.md) — no synthesized
// tones, no music, no bells. Samples are decoded once and played through
// Web Audio so 52 quick deal flicks don't stutter on phones.
const NAMES = {
  shuffle: ['shuffle'],
  deal: ['deal1', 'deal2', 'deal3'],
  play: ['play1', 'play2'],
  sweep: ['sweep'],
  bid: ['bid'],
  turn: ['turn'],
  win: ['win'],
  error: ['error'],
  tick: ['tick'],
}
const GAIN = {} // files are already loudness-matched (see public/sounds/SOURCES.md)
const MUTE_KEY = 'amaterasuu-noir-spades:muted'

let ctx = null
let master = null
const buffers = new Map() // file -> AudioBuffer | null (missing)
const loading = new Map()
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()

function audio() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function load(file) {
  if (buffers.has(file)) return Promise.resolve(buffers.get(file))
  if (loading.has(file)) return loading.get(file)
  const a = audio()
  if (!a) return Promise.resolve(null)
  const p = fetch(`/sounds/${file}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buf) => (buf ? a.decodeAudioData(buf) : null))
    .catch(() => null)
    .then((decoded) => {
      buffers.set(file, decoded)
      loading.delete(file)
      return decoded
    })
  loading.set(file, p)
  return p
}

export function preloadSounds() {
  for (const files of Object.values(NAMES)) files.forEach((f) => load(f))
}

// Sound is decoration: if the phone's audio fails, the game carries on.
export function playSound(name, opts) {
  try {
    playSoundUnsafe(name, opts)
  } catch (err) {
    console.warn('sound failed', name, err)
  }
}

function playSoundUnsafe(name, { delay = 0, volume = 1 } = {}) {
  if (muted) return
  const a = audio()
  const files = NAMES[name]
  if (!a || !files) return
  const available = files.filter((f) => buffers.get(f))
  const pick = available.length ? available[Math.floor(Math.random() * available.length)] : null
  if (!pick) {
    load(files[0])
    return
  }
  const src = a.createBufferSource()
  src.buffer = buffers.get(pick)
  src.playbackRate.value = name === 'deal' || name === 'play' ? 0.96 + Math.random() * 0.08 : 1
  const g = a.createGain()
  g.gain.value = (GAIN[name] ?? 1) * volume
  src.connect(g)
  g.connect(master)
  src.start(a.currentTime + delay / 1000)
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = !!value
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // ignore
  }
}

// Browsers only allow audio after a user gesture; unlock on the first tap.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio()
    preloadSounds()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}
