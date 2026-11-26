import { T } from '../../game/timing'

// Table layout maths. Seats are numbered 0..3 by the server; on screen your
// own seat is always at the bottom and the rest follow clockwise.
export const SLOTS = ['bottom', 'left', 'top', 'right']

export function slotOf(seat, mySeat) {
  return SLOTS[(seat - mySeat + 4) % 4]
}

export function tableCardWidth(w, h) {
  return Math.round(Math.max(46, Math.min(w * 0.15, h * 0.11, 92)))
}

export function handCardWidth(vw, vh) {
  const landscape = vw > vh
  return Math.round(Math.max(56, Math.min(vw * (landscape ? 0.075 : 0.17), vh * 0.15, 108)))
}

// Where a seat's cards come from / go to, in stage pixels.
export function seatAnchor(slot, w, h, cw) {
  const ch = cw * 1.4
  switch (slot) {
    case 'bottom':
      return { x: w / 2, y: h + ch * 0.55 }
    case 'top':
      return { x: w / 2, y: ch * 0.35 }
    case 'left':
      return { x: cw * 0.35, y: h * 0.46 }
    case 'right':
      return { x: w - cw * 0.35, y: h * 0.46 }
    default:
      return { x: w / 2, y: h / 2 }
  }
}

// Where a won trick's stack lands: just beside each seat's nameplate.
export function pileAnchor(slot, w, h, cw) {
  const ch = cw * 1.4
  switch (slot) {
    case 'bottom':
      return { x: w / 2, y: h - ch * 0.2 }
    case 'top':
      return { x: w / 2, y: ch * 0.7 }
    case 'left':
      return { x: cw * 0.9, y: h * 0.46 }
    case 'right':
      return { x: w - cw * 0.9, y: h * 0.46 }
    default:
      return { x: w / 2, y: h / 2 }
  }
}

export function tableCenter(w, h) {
  return { x: w / 2, y: h * 0.48 }
}

// Resting place of each seat's card in the current trick (centre offsets).
export function trickSlot(slot, cw) {
  const ch = cw * 1.4
  switch (slot) {
    case 'bottom':
      return { x: 0, y: ch * 0.4, r: 0 }
    case 'top':
      return { x: 0, y: -ch * 0.4, r: 0 }
    case 'left':
      return { x: -cw * 0.66, y: 0, r: -6 }
    case 'right':
      return { x: cw * 0.66, y: 0, r: 6 }
    default:
      return { x: 0, y: 0, r: 0 }
  }
}

// Small, stable jitter per card so a trick looks hand-placed, not gridded.
export function jitter(id, amount = 1) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (((h % 1000) / 1000) * 2 - 1) * amount
}

// Arrival time (ms after the deal starts) of the k-th card a seat receives.
export const DEAL_STAGGER = T.dealStagger
export const DEAL_FLIGHT = T.dealFlight
export function dealArrival(seat, k, dealer) {
  const offset = (seat - dealer - 1 + 8) % 4
  return (k * 4 + offset) * DEAL_STAGGER + DEAL_FLIGHT
}
