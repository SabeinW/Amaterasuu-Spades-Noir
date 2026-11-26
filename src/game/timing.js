// One place for every animation timing, so pacing stays consistent between
// the event player (how long to wait) and the components (how long to move).
// Slowed down Nov 26 after play-testing: moves were too quick to follow.
export const T = {
  // deal: one card every 42ms, each flight 460ms (52 cards ≈ 2.6s)
  dealStagger: 42,
  dealFlight: 460,
  // how long each event holds the table before the next one plays
  bid: 950,
  bidMine: 350,
  play: 950,
  playMine: 700, // your own card always gets this long on screen
  trick: 2300, // the whole "trick won" moment, below
  round: 900,
  game: 400,
  // card flight into the trick (seconds)
  cardFlight: 0.6,
  // trick won: total length (seconds) and the phase boundaries (fractions)
  sweep: 2.1,
  sweepLift: 0.1, // winning card lifts and glows
  sweepHold: 0.48, // everyone sees who won
  sweepGather: 0.64, // cards slide together into one stack
  // ...then the stack flies to the winner's seat
}

export const DEAL_TOTAL = 52 * T.dealStagger + T.dealFlight
