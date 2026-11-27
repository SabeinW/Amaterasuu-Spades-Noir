// Phone mode. iPhone Safari redraws parts of the screen on the main thread,
// so animations that can't be handed to the graphics chip (glows, blurs,
// moving gradients) on every picture card made the table drop to a few
// frames a second, and taps, moves and pictures waited behind the drawing.
// On touch screens we keep the art but skip those effects. The class on
// <html> lets CSS do the same (see `.lite` in index.css).
//
// Override for testing: localStorage 'amaterasuu-noir-spades:lite' = '1' (on) or '0' (off).
function detect() {
  if (typeof window === 'undefined') return false
  try {
    const forced = localStorage.getItem('amaterasuu-noir-spades:lite')
    if (forced === '1') return true
    if (forced === '0') return false
  } catch {
    // storage blocked: fall back to the pointer check
  }
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

export const LITE = detect()
if (LITE && typeof document !== 'undefined') document.documentElement.classList.add('lite')
