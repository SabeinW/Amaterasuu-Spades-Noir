// Practice table vs three AI players: the same rules engine as the server,
// run in the browser. Saved to localStorage after every move so a refresh
// (or a phone killing the tab) can pick the game back up.
import { useCallback, useState } from 'react'
import * as E from '../lib/engine'

const SAVE_KEY = 'amaterasuu-noir-spades:practice'
export const PRACTICE_BOTS = ['Nyx', 'Kestrel', 'Osiris']
const CONTROL = ['human', 'bot', 'bot', 'bot']

const ctx = () => ({ now: Date.now(), rng: Math.random, control: CONTROL })

export function loadSavedPractice() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved?.full?.pub?.v || saved.full.pub.v !== E.ENGINE_VERSION) return null
    if (saved.full.pub.phase === 'game_over') return null
    return saved
  } catch {
    return null
  }
}

export function clearSavedPractice() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // storage unavailable
  }
}

function save(full, myName, coached) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ full, myName, coached: !!coached, savedAt: Date.now() }))
  } catch {
    // storage full / private mode — the game still works, it just won't resume
  }
}

// A coached game (Learn to play) keeps your house rules but leaves out Blind
// Nil (bidding before you look is no way to learn) and ends at 300.
export const coachedRules = (rules) => ({ ...rules, blindNil: false, winScore: Math.min(Number(rules.winScore) || 500, 300) })

export function useLocalGame({ rules, myName, resume, coached = false }) {
  const [full, setFull] = useState(() => {
    if (resume?.full) return resume.full
    const f = E.createMatch({ ...(coached ? coachedRules(rules) : rules), timers: false })
    E.startMatch(f, ctx())
    save(f, myName, coached)
    return f
  })

  const act = useCallback(
    async (move) => {
      const next = E.cloneFull(full)
      E.act(next, 0, move, ctx()) // throws EngineError for illegal moves
      setFull(next)
      if (next.pub.phase === 'game_over') clearSavedPractice()
      else save(next, myName, coached)
      return { room: null }
    },
    [full, myName, coached]
  )

  const players = [
    { id: 'me', name: myName, seat: 0 },
    ...PRACTICE_BOTS.map((name, i) => ({ id: `__bot__${i + 1}`, name, seat: i + 1, isBot: true })),
  ]

  return {
    room: null,
    pub: full.pub,
    players,
    mySeat: 0,
    hand: { round: full.pub.round, cards: full.hands[0] },
    act,
    connection: 'local',
    serverNow: Date.now,
  }
}
