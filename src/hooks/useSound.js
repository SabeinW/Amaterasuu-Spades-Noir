let sharedCtx = null
let muted = false

function getCtx() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!sharedCtx) sharedCtx = new Ctor()
  if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {})
  return sharedCtx
}

export function setSoundMuted(value) {
  muted = value
}

export function isSoundMuted() {
  return muted
}

function tone(ctx, { freq, start, duration, type = 'sine', gain = 0.18, sweepTo }) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration)
  amp.gain.setValueAtTime(0, start)
  amp.gain.linearRampToValueAtTime(gain, start + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

// Web Audio-synthesized SFX — no external audio assets required.
const PLAYERS = {
  shuffle: (ctx) => {
    const now = ctx.currentTime
    for (let i = 0; i < 10; i++) {
      tone(ctx, { freq: 900 + Math.random() * 600, start: now + i * 0.045, duration: 0.05, type: 'square', gain: 0.05 })
    }
  },
  deal: (ctx) => {
    tone(ctx, { freq: 700, start: ctx.currentTime, duration: 0.06, type: 'square', gain: 0.06 })
  },
  bid: (ctx) => {
    const now = ctx.currentTime
    tone(ctx, { freq: 520, start: now, duration: 0.12, type: 'triangle', gain: 0.16 })
    tone(ctx, { freq: 780, start: now + 0.07, duration: 0.12, type: 'triangle', gain: 0.14 })
  },
  cardPlay: (ctx) => {
    tone(ctx, { freq: 260, start: ctx.currentTime, duration: 0.08, type: 'triangle', gain: 0.12, sweepTo: 180 })
  },
  trickWin: (ctx) => {
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      tone(ctx, { freq, start: now + i * 0.09, duration: 0.22, type: 'sine', gain: 0.16 })
    })
  },
  fanfare: (ctx) => {
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(ctx, { freq, start: now + i * 0.14, duration: 0.4, type: 'sawtooth', gain: 0.12 })
    })
  },
  error: (ctx) => {
    const now = ctx.currentTime
    tone(ctx, { freq: 220, start: now, duration: 0.18, type: 'square', gain: 0.14 })
    tone(ctx, { freq: 160, start: now + 0.12, duration: 0.18, type: 'square', gain: 0.14 })
  },
}

export function useSound(name) {
  return () => {
    if (muted) return
    const ctx = getCtx()
    const play = PLAYERS[name]
    if (!ctx || !play) return
    try {
      play(ctx)
    } catch {
      // audio not available in this environment
    }
  }
}
