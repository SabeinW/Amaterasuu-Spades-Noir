// The table. Works the same for online tables and practice games: it is
// handed a `game` source ({ pub, players, mySeat, hand, act, ... }) and
// renders/animates whatever that source says, sending moves back through
// `act`. All rules live in the engine; nothing here decides who won.
import { AnimatePresence, motion } from 'motion/react'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import * as E from '../../lib/engine'
import { playSound, isMuted, setMuted } from '../../lib/sound'
import { useEventPlayer } from '../../game/useEventPlayer'
import { T } from '../../game/timing'
import { fetchAvatars, leaveTable, openTableChannel, recordPracticeResult, renameAtTable } from '../../lib/online'
import { fetchProfile } from '../../lib/auth'
import { checkAndUnlockAchievements, listFriends, unlockAchievementNow } from '../../lib/social'
import { rankForRating, rankIndex } from '../../data/ranks'
import { TIER_STYLE } from '../../data/achievements'
import { levelColor, levelForXp, titleForLevel } from '../../data/levels'
import Seat from './Seat'
import HandFan from './HandFan'
import TrickArea from './TrickArea'
import DealLayer from './DealLayer'
import BidSheet from './BidSheet'
import ScoreBar from './ScoreBar'
import { MatchSummary, RoundSummary, luckTotals } from './Summaries'
import { ChatSheet, RulesSummary, TableMenu } from './TableExtras'
import { DeckPicker, TablePicker } from '../ThemePickers'
import CoachBubble from './CoachBubble'
import { EmoteTray } from './EmotePicker'
import { GifSheet } from './GifPicker'
import { gifsEnabled } from '../../lib/giphy'
import { BOT_TALK, emotePayload, moodOf, pickFrom, readEmote, rememberPick } from '../../data/taunts'
import { useSkinTone } from '../../lib/skinTone'
import { SmilePlus } from 'lucide-react'
import { bidAdvice, blockedReason, playAdvice, roundStory, trickStory } from '../../lib/coach'
import ProfileModal from '../ProfileModal'
import { CardBack } from '../cards/Card'
import { DEAL_FLIGHT, DEAL_STAGGER, dealArrival, handCardWidth, slotOf, tableCardWidth, tableCenter } from './geometry'

const OVERBID = [
  (t) => `${t} bids on 13 tricks — somebody's lying their whole butt off.`,
  (t) => `Fraud alert: ${t} bids for 13 tricks. Y'all cannot ALL be that good.`,
  (t) => `${t} combined bids. Bold strategy — let's see how it pans out.`,
  (t) => `${t} bids on the table. This table's about to catch some bags.`,
]
const UNDERBID = [
  (t) => `Only ${t} bids for 13 tricks — free tricks lying around.`,
  (t) => `${t} bids total? Somebody's sandbagging.`,
  (t) => `Only ${t} bids. Who's hiding a monster hand?`,
  (t) => `${t} bids — ice cold table today.`,
]

function useMeasure() {
  const ref = useRef(null)
  const [rect, setRect] = useState({ w: 0, h: 0, left: 0, top: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ w: r.width, h: r.height, left: r.left, top: r.top })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return [ref, rect]
}

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

// Re-render on a short tick while a deal is flying so seat card counts grow.
function useDealClock(dealInfo) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!dealInfo) return
    const end = dealInfo.startedAt + 52 * DEAL_STAGGER + DEAL_FLIGHT + 100
    if (Date.now() > end) return
    const t = setInterval(() => {
      setTick((n) => n + 1)
      if (Date.now() > end) clearInterval(t)
    }, 70)
    return () => clearInterval(t)
  }, [dealInfo])
}

// An opponent's hand: a small fan of card backs held toward the centre.
function MiniFan({ count, slot, cw, deck }) {
  const n = Math.min(count, 13)
  if (!n) return null
  const small = Math.round(cw * 0.5)
  const sh = small * 1.4
  const spread = Math.min(7, 70 / Math.max(n, 1))
  const box = sh * 1.25
  const rot = slot === 'top' ? 180 : slot === 'left' ? -90 : slot === 'right' ? 90 : 0
  // Side seats hold the fan on its side, so its spread becomes its height.
  // Make the box that tall (the outer card's far corner, swung round the
  // pivot below the cards) so the fan never rides up over the seat's bid.
  const phi = (((n - 1) / 2) * spread * Math.PI) / 180
  const reach = (small / 2) * Math.cos(phi) + sh * 1.1 * Math.sin(phi)
  const height = slot === 'left' || slot === 'right' ? Math.max(box * 0.78, 2 * reach + 4) : box * 0.78
  return (
    <div className="relative pointer-events-none" style={{ width: box, height }}>
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -50%) rotate(${rot}deg)` }}>
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: -small / 2,
              top: -sh / 2,
              transformOrigin: `50% ${sh * 1.1}px`,
              transform: `rotate(${(i - (n - 1) / 2) * spread}deg)`,
            }}
          >
            <CardBack width={small} deck={deck} />
          </div>
        ))}
      </div>
    </div>
  )
}

const COACH_KEY = 'amaterasuu-noir-spades:coach'
const coachPref = () => {
  try {
    return localStorage.getItem(COACH_KEY) === '1'
  } catch {
    return false
  }
}

export default function GameTable({ game, mode, coached = false, deck, table, user, profile, onProfileUpdate, onSignOut, onChangeDeck, onChangeTable, customTables, onDeleteCustomTable, onExit }) {
  const online = mode === 'online'
  const { pub, players, mySeat, hand, act, connection, serverNow, room } = game
  const rules = pub?.rules
  const myTeam = E.teamOf(mySeat)
  const theirTeam = myTeam === 'A' ? 'B' : 'A'
  const partnerSeat = E.partnerOf(mySeat)

  const [stageRef, stage] = useMeasure()
  const vp = useViewport()
  const cw = tableCardWidth(stage.w || 360, stage.h || 560)
  const hw = handCardWidth(vp.w, vp.h)

  const [toasts, setToasts] = useState([])
  const toast = useCallback((text, tone = 'info', icon, ms = 4200) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t.slice(-3), { id, text, tone, icon }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms)
  }, [])

  const [dealInfo, setDealInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(() => new Set())
  const [revealedRound, setRevealedRound] = useState(-1)
  const [menu, setMenu] = useState(null) // menu | deck | table | rules | profile | chat
  const [muted, setMutedState] = useState(isMuted())
  const [messages, setMessages] = useState([])
  const [unread, setUnread] = useState(0)
  const [emotes, setEmotes] = useState({})
  const [present, setPresent] = useState(null)
  const [avatars, setAvatars] = useState({})
  const [rankUp, setRankUp] = useState(null)
  const [levelUp, setLevelUp] = useState(null)
  // A won trick is in flight to this seat: hold its count back until it lands.
  const [pendingWin, setPendingWin] = useState(null)
  const [burst, setBurst] = useState(null)
  // The coach: always on in a coached game, a menu switch in other practice games, never online.
  const [coachOn, setCoachOn] = useState(() => !online && (coached || coachPref()))
  const [coachMin, setCoachMin] = useState(false)
  const [coachH, setCoachH] = useState(0)
  const blockedAtRef = useRef(0)
  const fromRects = useRef({})
  const streakRef = useRef(0)
  const maxDeficitRef = useRef(0)
  const madeInRowRef = useRef(0)
  const lastTurnSoundRef = useRef(null)
  const recordedRef = useRef(false)
  // Table talk: the tray, my send times (spam limit), and the practice bots' banter.
  const tone = useSkinTone()
  const [trayOpen, setTrayOpen] = useState(false)
  const [gifOpen, setGifOpen] = useState(false)
  const sentRef = useRef([])
  const heardRef = useRef({})
  const botTalkAtRef = useRef(0)
  const queuedTalkRef = useRef(null)
  const botEventRef = useRef(null)

  const seatPlayer = useCallback((s) => players.find((p) => p.seat === s), [players])

  // ── events → sound & effects ──────────────────────────────────────────
  const onEvent = useCallback(
    (ev, next) => {
      botEventRef.current?.(ev, next)
      switch (ev.t) {
        case 'deal':
          setDealInfo({ key: ev.seq, dealer: ev.dealer, startedAt: Date.now() })
          setRevealedRound(-1)
          recordedRef.current = false
          playSound('shuffle')
          for (let i = 0; i < 52; i += 2) playSound('deal', { delay: 700 + i * DEAL_STAGGER })
          break
        case 'bid':
          playSound('bid')
          if (next.bids.every((b) => b !== null)) {
            const total = next.bids.reduce((a, b) => a + b, 0)
            if (total !== 13) {
              const pool = total > 13 ? OVERBID : UNDERBID
              toast(pool[(next.round * 7 + total) % pool.length](total), 'warn', total > 13 ? '🎭' : '🧊', 6500)
            }
          }
          break
        case 'play':
          playSound('play')
          break
        case 'trick': {
          const flyAt = T.sweep * T.sweepGather * 1000
          playSound('sweep', { delay: flyAt - 120 })
          setPendingWin({ seat: ev.winner, seq: ev.seq })
          setTimeout(() => {
            setPendingWin((p) => (p?.seq === ev.seq ? null : p))
            setBurst({ seat: ev.winner, key: ev.seq })
          }, T.sweep * 1000 - 80)
          if (ev.winner === mySeat) {
            streakRef.current += 1
            const live = { 4: 'walk_em_down', 7: 'run_the_table' }[streakRef.current]
            if (live && user?.id) {
              unlockAchievementNow(user.id, live).then((a) => a && toast(`Achievement: ${a.title}`, 'gold', a.icon, 5500))
            }
          } else streakRef.current = 0
          break
        }
        case 'round': {
          const deficit = ev.result[theirTeam].total - ev.result[myTeam].total
          maxDeficitRef.current = Math.max(maxDeficitRef.current, deficit)
          {
            // Hands in a row where you made your bid (or your nil).
            const mine = ev.result.seats[mySeat]
            const made = mine.bid === 0 ? mine.taken === 0 : mine.taken >= mine.bid
            madeInRowRef.current = made ? madeInRowRef.current + 1 : 0
            const live = { 3: 'hot_hands', 5: 'on_fire' }[madeInRowRef.current]
            if (live && user?.id) {
              unlockAchievementNow(user.id, live).then((a) => a && toast(`Achievement: ${a.title}`, 'gold', a.icon, 5500))
            }
          }
          if (user?.id) {
            const mine = ev.result.seats[mySeat]
            const partner = ev.result.seats[partnerSeat]
            checkAndUnlockAchievements(user.id, 'round', {
              bid: mine.bid,
              taken: mine.taken,
              blindNil: mine.blind,
              partnerBid: partner.bid,
              partnerTaken: partner.taken,
            }).then((list) => list.forEach((a) => toast(`Achievement: ${a.title}`, 'gold', a.icon, 5500)))
          }
          break
        }
        case 'game':
          if (ev.winner === myTeam) playSound('win')
          break
        default:
          break
      }
    },
    [mySeat, myTeam, theirTeam, partnerSeat, toast, user?.id]
  )

  const { view, event, playOptimistic, resync } = useEventPlayer(pub, { mySeat, onEvent })
  useDealClock(dealInfo)

  // Your-turn nudge sound.
  useEffect(() => {
    if (!view) return
    const key = `${view.seq}`
    const mine = view.turn === mySeat && (view.phase === 'playing' || view.phase === 'bidding')
    if (mine && event?.t !== 'trick' && lastTurnSoundRef.current !== key && view.phase === 'playing' && view.trick.length === 0) {
      lastTurnSoundRef.current = key
      playSound('turn', { delay: 250 })
    }
  }, [view, mySeat, event?.t])

  // Clear optimistic plays once the server's hand no longer has them.
  useEffect(() => {
    if (!pending.size) return
    const ids = new Set(hand.cards.map((c) => c.id))
    const still = [...pending].filter((id) => ids.has(id))
    if (still.length !== pending.size) setPending(new Set(still))
  }, [hand, pending])

  // ── online extras: avatars, presence, chat, emotes ─────────────────────
  const humanIds = players.filter((p) => !p.isBot && !p.id.startsWith('__')).map((p) => p.id).join(',')
  useEffect(() => {
    if (!online || !humanIds) return
    fetchAvatars(humanIds.split(',')).then(setAvatars)
  }, [online, humanIds])

  const channelRef = useRef(null)
  useEffect(() => {
    if (!online || !room?.id || !user?.id) return
    const me = players.find((p) => p.id === user.id)
    const ch = openTableChannel(room.id, { id: user.id, name: me?.name ?? 'Player' }, {
      onEmote: (payload) => {
        // Only what's on the lists, from a real seat, and not faster than a seat can read.
        const seat = payload?.seat
        if (![0, 1, 2, 3].includes(seat)) return
        const now = Date.now()
        if (now - (heardRef.current[seat] ?? 0) < 400) return
        heardRef.current[seat] = now
        const shown = readEmote(payload)
        if (shown) showEmote(seat, shown)
      },
      onChat: ({ author, text }) => {
        setMessages((m) => [...m, { author, text }])
        setUnread((u) => u + 1)
      },
      onPresence: (ids) => setPresent(new Set(ids)),
    })
    channelRef.current = ch
    return () => {
      channelRef.current = null
      ch.close()
    }
  }, [online, room?.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function showEmote(seat, shown) {
    const id = Math.random()
    setEmotes((e) => ({ ...e, [seat]: { ...shown, id } }))
    setTimeout(() => setEmotes((e) => (e[seat]?.id === id ? { ...e, [seat]: null } : e)), shown.kind === 'g' ? 4200 : shown.kind === 'l' ? 3000 : 1900)
  }

  // Throw an emoji or a line. Six in ten seconds at most, so nobody floods the table.
  function sendEmote(pick) {
    const now = Date.now()
    const recent = sentRef.current.filter((t) => now - t < 10000)
    if (recent.length >= 6 || now - (recent[recent.length - 1] ?? 0) < 700) {
      toast('Easy — let them read that one first.', 'info', '⏳', 2000)
      return false
    }
    sentRef.current = [...recent, now]
    const payload = emotePayload(mySeat, pick, tone)
    showEmote(mySeat, readEmote(payload))
    rememberPick(pick)
    if (online) channelRef.current?.send('EMOTE', payload)
    else if (botsTalk) botReply(pick)
    return true
  }

  // ── practice bots talk back (not in a coached game: that table stays friendly) ──
  const botsTalk = !online && !coached
  const opponentsOf = (seat) => [E.nextSeat(seat), E.nextSeat(E.partnerOf(seat))]
  const botTone = (seat) => ['brown', 'deep', 'brown', 'light'][seat]
  function botSay(seat, pick, delay) {
    const at = Date.now() + delay
    if (!seatPlayer(seat)?.isBot || at - botTalkAtRef.current < 3000) return
    botTalkAtRef.current = at
    setTimeout(() => showEmote(seat, readEmote({ ...pick, tone: botTone(seat) })), delay)
  }
  const someBot = (seats) => {
    const bots = seats.filter((s) => seatPlayer(s)?.isBot)
    return bots.length ? pickFrom(bots) : null
  }
  function botReply(pick) {
    const mood = moodOf(pick)
    const delay = 900 + Math.random() * 700
    const roll = Math.random()
    const opp = someBot(opponentsOf(mySeat))
    if (mood === 'talk' && roll < 0.55 && opp !== null) botSay(opp, pickFrom(BOT_TALK.comeback), delay)
    else if (mood === 'hype' && roll < 0.4) botSay(partnerSeat, pickFrom(BOT_TALK.partnerHype), delay)
    else if (mood === 'partner') botSay(partnerSeat, pickFrom(pick.id === 'partnerwhat' ? BOT_TALK.partnerSorry : BOT_TALK.partnerHype), delay)
    else if (mood === 'nice' && roll < 0.6 && opp !== null) botSay(opp, pickFrom(BOT_TALK.nice), delay)
    else if (mood === 'react' && roll < 0.2 && opp !== null) botSay(opp, { kind: 'e', id: '😂' }, delay)
  }
  botEventRef.current = !botsTalk
    ? null
    : (ev, next) => {
        const afterSweep = T.sweep * 1000 + 250
        if (ev.t === 'trick') {
          const w = ev.winner
          // A Nil just broke: the other side lets them hear it.
          if (next.bids[w] === 0 && next.tricks[w] === 1) {
            const who = someBot(opponentsOf(w))
            if (who !== null && Math.random() < 0.75) botSay(who, pickFrom(BOT_TALK.nilBust), afterSweep)
            return
          }
          // A spade cut a trick in another suit.
          const jd = next.rules?.jokers
          const led = E.effectiveSuit(ev.cards[0].card, jd)
          const won = ev.cards.find((c) => c.seat === w)?.card
          if (led !== 'S' && won && E.effectiveSuit(won, jd) === 'S') {
            if (seatPlayer(w)?.isBot && Math.random() < 0.3) botSay(w, pickFrom(BOT_TALK.cut), afterSweep)
            else if (w === mySeat && Math.random() < 0.2) {
              const who = someBot(opponentsOf(mySeat))
              if (who !== null) botSay(who, { kind: 'e', id: pickFrom(['🧂', '🙄', '😤']) }, afterSweep)
            }
          }
        } else if (ev.t === 'round') {
          // The summary covers the table, so round talk waits for the next deal.
          const r = ev.result
          const weSet = r[myTeam].made === false
          const theySet = r[theirTeam].made === false
          const opp = someBot(opponentsOf(mySeat))
          queuedTalkRef.current = null
          if (weSet && !theySet && opp !== null && Math.random() < 0.8) queuedTalkRef.current = { seat: opp, pick: pickFrom(BOT_TALK.setThem) }
          else if (theySet && Math.random() < 0.7) {
            queuedTalkRef.current =
              Math.random() < 0.5 && opp !== null ? { seat: opp, pick: pickFrom(BOT_TALK.gotSet) } : { seat: partnerSeat, pick: pickFrom(BOT_TALK.setThem) }
          } else {
            const nil = r[theirTeam].nils.find((n) => n.ok)
            if (nil && Math.random() < 0.6) queuedTalkRef.current = { seat: nil.seat, pick: pickFrom(BOT_TALK.nilMade) }
          }
        } else if (ev.t === 'deal' && queuedTalkRef.current) {
          const { seat, pick } = queuedTalkRef.current
          queuedTalkRef.current = null
          botSay(seat, pick, 1600)
        }
      }

  // ── end of match: stats, rank-up, achievements ─────────────────────────
  useEffect(() => {
    if (view?.phase !== 'game_over' || !view.winner || recordedRef.current || !user?.id) return
    recordedRef.current = true
    const won = view.winner === myTeam
    const yourScore = view.scores[myTeam].total
    const oppScore = view.scores[theirTeam].total
    const before = profile?.elo_rating ?? 1200
    const xpBefore = profile?.xp ?? 0
    const afterProfile = online
      ? new Promise((r) => setTimeout(r, 900)).then(() => fetchProfile(user.id))
      : recordPracticeResult({ won, yourScore, opponentScore: oppScore, rounds: view.round })
    afterProfile.then(async (updated) => {
      if (!updated) return
      onProfileUpdate?.(updated)
      const a = rankForRating(before)
      const b = rankForRating(updated.elo_rating ?? 1200)
      if (rankIndex(b.id) > rankIndex(a.id)) setRankUp(b)
      const gained = (updated.xp ?? 0) - xpBefore
      if (gained > 0) toast(`+${gained} XP`, 'gold', '✨', 4500)
      const lvBefore = levelForXp(xpBefore)
      const lvAfter = levelForXp(updated.xp ?? 0)
      if (lvAfter > lvBefore) setTimeout(() => setLevelUp({ level: lvAfter, title: titleForLevel(lvAfter), newTitle: titleForLevel(lvAfter) !== titleForLevel(lvBefore) }), rankIndex(b.id) > rankIndex(a.id) ? 2600 : 600)
      const { friends } = await listFriends(user.id)
      const list = await checkAndUnlockAchievements(user.id, 'match', {
        won,
        marginOfVictory: yourScore - oppScore,
        moonShot: !!view.moon,
        profile: updated,
        friendCount: friends.length,
        maxDeficit: maxDeficitRef.current,
      })
      list.forEach((x) => toast(`Achievement: ${x.title}${TIER_STYLE[x.tier] ? ` · ${TIER_STYLE[x.tier].label}` : ''}`, 'gold', x.icon, 6000))
    })
  }, [view?.phase, view?.winner]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!view || !rules) {
    return (
      <div className="fixed inset-0 lacquer flex items-center justify-center">
        <p className="text-muted animate-pulse">Taking your seat…</p>
      </div>
    )
  }

  // ── derived state ──────────────────────────────────────────────────────
  const handCards = hand.round === view.round ? hand.cards.filter((c) => !pending.has(c.id)) : []
  const myBidTurn = view.phase === 'bidding' && view.turn === mySeat && pub.phase === 'bidding' && pub.turn === mySeat
  // (not while the last trick is still being collected — you'd play over the animation)
  const myPlayTurn = view.phase === 'playing' && view.turn === mySeat && pub.phase === 'playing' && pub.turn === mySeat && view.trick.length < 4 && event?.t !== 'trick'
  const blindPending = rules.blindNil && view.phase === 'bidding' && view.bids[mySeat] === null && revealedRound !== view.round
  const playable = myPlayTurn ? new Set(handCards.filter((c) => E.isPlayable(c, hand.cards, view.trick, view.broken, rules.jokers, rules.spadesBreak)).map((c) => c.id)) : null
  const trumpIds = rules.jokers ? new Set(handCards.filter((c) => c.suit === 'D' && c.value === '2').map((c) => c.id)) : null
  const dealing = dealInfo && Date.now() - dealInfo.startedAt < 52 * DEAL_STAGGER + DEAL_FLIGHT + 60 ? dealInfo : null
  const center = tableCenter(stage.w, stage.h)
  const dealFrom = dealing ? { x: stage.left + center.x, y: stage.top + center.y } : null
  const visibleCount = (seat) => {
    if (!dealing) return view.counts[seat]
    const el = Date.now() - dealing.startedAt
    let n = 0
    for (let k = 0; k < 13; k++) if (dealArrival(seat, k, dealing.dealer) <= el) n++
    return Math.min(n, view.counts[seat])
  }

  const scoreFor = (team) => ({ total: view.scores[team].total, bags: view.scores[team].bags, limit: rules.bagLimit })

  async function send(move) {
    setBusy(true)
    try {
      await act(move)
    } catch (err) {
      playSound('error')
      toast(err.message || 'That move was refused.', 'error')
      resync()
    } finally {
      setBusy(false)
    }
  }

  function onPlay(card, rect) {
    if (!myPlayTurn || busy || pending.size) return
    if (playable && !playable.has(card.id)) return
    if (rect) fromRects.current[card.id] = { x: rect.left + rect.width / 2 - stage.left, y: rect.top + rect.height / 2 - stage.top }
    setPending((p) => new Set(p).add(card.id))
    playOptimistic(mySeat, card)
    act({ type: 'play', card: card.id }).catch((err) => {
      playSound('error')
      toast(err.message || 'That card was refused.', 'error')
      setPending((p) => {
        const n = new Set(p)
        n.delete(card.id)
        return n
      })
      resync()
    })
  }

  async function leave() {
    setMenu(null)
    if (online && room?.id) leaveTable(room.id).catch(() => {})
    onExit?.(view.phase === 'game_over')
  }

  function toggleMute() {
    setMuted(!muted)
    setMutedState(!muted)
  }

  const suggested = myBidTurn && handCards.length ? Math.max(E.minimumBid(view, mySeat, rules), E.estimateBid(handCards, rules.jokers)) : undefined
  const nameOf = (s) => seatPlayer(s)?.name ?? 'They'
  const bidCoach = coachOn && myBidTurn && !blindPending && handCards.length ? bidAdvice(handCards, view, mySeat, rules, nameOf) : null
  const playCoach = coachOn && myPlayTurn && !pending.size && handCards.length ? playAdvice(handCards, view, mySeat, rules, nameOf) : null
  const coachLines = (() => {
    if (!coachOn || dealing) return null
    if (view.phase === 'bidding' && !myBidTurn) {
      const opps = [E.nextSeat(mySeat), E.nextSeat(partnerSeat)].map(nameOf).join(' and ')
      return { title: 'Coach · bidding', lines: [`Everyone says how many tricks they think they'll win. ${nameOf(partnerSeat)} (top) is your partner; ${opps} play against you.`, `${nameOf(view.turn)} is bidding…`] }
    }
    if (view.phase !== 'playing') return null
    if (playCoach) return { title: 'Coach · your turn', lines: [playCoach.rule, playCoach.winner, playCoach.tip].filter(Boolean) }
    const story = trickStory(view.last_trick, rules, nameOf, mySeat)
    const now = view.trick.length && event?.t !== 'trick' ? `${nameOf(view.turn)} is up next.` : null
    if (!story && !now) return { title: 'Coach', lines: [`${nameOf(view.turn)} leads the first trick. Watch what gets played.`] }
    return { title: 'Coach', lines: [story, now].filter(Boolean) }
  })()
  function onBlocked(card) {
    if (Date.now() - blockedAtRef.current < 1500) return
    blockedAtRef.current = Date.now()
    playSound('error')
    toast(blockedReason(card, hand.cards, view, rules), 'warn', '✋', 3500)
  }
  function toggleCoach() {
    const next = !coachOn
    setCoachOn(next)
    if (!coached) {
      try {
        localStorage.setItem(COACH_KEY, next ? '1' : '0')
      } catch {
        // storage unavailable: the switch still works for this game
      }
    }
  }
  const turnPlayer = seatPlayer(view.turn)
  // You're seated under your account id online, but as 'me' in practice.
  const isMe = (p) => !!p && !p.isBot && (p.id === user?.id || p.id === 'me')
  const avatarFor = (p) => (isMe(p) ? profile?.avatar_url : avatars[p?.id])
  const seatProps = (seat) => {
    const p = seatPlayer(seat)
    return {
      player: p,
      avatarUrl: avatarFor(p),
      bid: view.bids[seat],
      blind: view.blind[seat],
      tricks: view.tricks[seat] - (pendingWin?.seat === seat ? 1 : 0),
      burst: burst?.seat === seat ? burst.key : null,
      isTurn: view.turn === seat && (view.phase === 'bidding' || view.phase === 'playing'),
      isDealer: view.dealer === seat,
      isPartner: seat === partnerSeat,
      deadline: view.turn === seat ? view.deadline : null,
      total: view.phase === 'bidding' ? E.TIMERS.bidMs : E.TIMERS.playMs,
      serverNow,
      phase: view.phase,
      emote: emotes[seat],
      online: !online || !p || p.isBot || !present || present.has(p.id),
    }
  }

  // What everyone was dealt in the round just finished. The server adds it to
  // the result; for one that doesn't yet, rebuild it from the round's plays.
  const roundOver = view.phase === 'round_over' || view.phase === 'game_over'
  const roundDealt = !roundOver
    ? null
    : (view.round_result?.dealt ??
      (() => {
        const h = E.dealtHands(pub?.events ?? [], view.round)
        return h ? E.dealtSummary(h, rules.jokers) : null
      })())
  const luck = roundOver ? luckTotals(view.history, roundDealt && { round: view.round, spades: roundDealt.map((d) => d.spades), big: roundDealt.map((d) => d.big.length) }) : null

  const toastsUp = trayOpen || gifOpen || !!emotes[mySeat]

  const statusText = (() => {
    if (view.phase === 'bidding') {
      if (myBidTurn) return null
      return `${turnPlayer?.id === user?.id ? 'You' : turnPlayer?.name ?? '…'} ${view.turn === mySeat ? 'are' : 'is'} bidding`
    }
    if (view.phase === 'playing' && myPlayTurn) return view.trick.length === 0 ? 'Your lead' : 'Your turn'
    return null
  })()

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ background: table.base ?? '#0b0a08' }}>
      {/* table surface */}
      <div className="absolute inset-0" style={{ background: `url(${table.image}) center / cover no-repeat` }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 55% at 50% 46%, transparent 35%, rgb(0 0 0 / 0.55) 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(40% 30% at 50% 46%, rgb(241 210 138 / 0.08), transparent 70%)', animation: 'sunBreath 7s ease-in-out infinite' }} />

      <ScoreBar
        us={scoreFor(myTeam)}
        them={scoreFor(theirTeam)}
        target={rules.winScore}
        round={view.round}
        broken={view.broken}
        onMenu={() => setMenu('menu')}
        onChat={
          online
            ? () => {
                setMenu('chat')
                setUnread(0)
              }
            : undefined
        }
        unread={unread}
        connection={connection}
      />

      {/* stage */}
      <div ref={stageRef} className="relative flex-1 min-h-0 w-full max-w-[1100px] mx-auto">
        {[1, 2, 3].map((offset) => {
          const seat = (mySeat + offset) % 4
          const slot = slotOf(seat, mySeat)
          const pos =
            slot === 'top'
              ? 'top-1 left-1/2 -translate-x-1/2 flex-col'
              : slot === 'left'
                ? 'left-1.5 top-[44%] -translate-y-1/2 flex-col'
                : 'right-1.5 top-[44%] -translate-y-1/2 flex-col'
          return (
            // While a seat is talking it sits over the trick cards (z 22–32), so its bubble isn't hidden.
            <div key={seat} className={`absolute ${emotes[seat] ? 'z-[35]' : 'z-10'} flex items-center gap-1 ${pos}`}>
              <Seat slot={slot} {...seatProps(seat)} compact={stage.w < 420} />
              <MiniFan count={visibleCount(seat)} slot={slot} cw={cw} deck={deck} />
            </div>
          )
        })}

        <TrickArea
          view={view}
          event={event}
          mySeat={mySeat}
          partnerSeat={partnerSeat}
          nameOf={(s) => seatPlayer(s)?.name ?? 'They'}
          w={stage.w}
          h={stage.h}
          cw={cw}
          deck={deck}
          fromRects={fromRects}
        />
        {dealing && stage.w > 0 && <DealLayer key={dealing.key} dealer={dealing.dealer} mySeat={mySeat} w={stage.w} h={stage.h} cw={cw} deck={deck} />}

        <AnimatePresence>
          {statusText && (
            <motion.div
              key={statusText}
              className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
              style={{ top: center.y + cw * 1.15 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className={`text-[13px] font-bold tracking-wide whitespace-nowrap ${myPlayTurn ? 'leaf-shimmer text-[15px]' : 'text-muted'}`}>{statusText}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* you */}
      {/* Lifted while you're talking: above the trick cards (z 22–32), and with the tray open above everything on the table. */}
      <div className={`relative ${trayOpen ? 'z-[45]' : emotes[mySeat] ? 'z-[35]' : 'z-30'} pb-[calc(0.25rem+var(--safe-b))]`}>
        {coachLines && !myBidTurn && view.phase !== 'round_over' && view.phase !== 'game_over' && (
          <CoachBubble title={coachLines.title} lines={coachLines.lines} minimized={coachMin} onToggle={() => setCoachMin((m) => !m)} onHeight={setCoachH} />
        )}
        <div className="relative flex items-center justify-center gap-3 mb-1 px-2">
          <EmoteTray
            open={trayOpen}
            onClose={() => setTrayOpen(false)}
            onPick={(pick) => {
              if (sendEmote(pick)) setTrayOpen(false)
            }}
            onGif={
              gifsEnabled
                ? () => {
                    setTrayOpen(false)
                    setGifOpen(true)
                  }
                : undefined
            }
          />
          <div className="relative">
            <Seat slot="bottom" {...seatProps(mySeat)} compact />
            {!blindPending && (
              // .btn sets its own position, so the spot beside the seat comes from a wrapper
              <span className="absolute left-full top-1/2 ml-2.5" style={{ transform: 'translateY(-50%)' }}>
                <button className="btn btn-icon !w-10 !h-10" onClick={() => setTrayOpen((o) => !o)} aria-label="Trash talk" aria-expanded={trayOpen}>
                  <SmilePlus className="w-[18px] h-[18px]" />
                </button>
              </span>
            )}
          </div>
          {blindPending && !myBidTurn && (
            <button className="btn btn-ghost !min-h-9 !px-3 !text-[12px] leading-tight" onClick={() => setRevealedRound(view.round)}>
              Look at my cards
              <span className="text-faint font-medium">(no Blind Nil)</span>
            </button>
          )}
        </div>
        <AnimatePresence>
          {myBidTurn && !busy && (
            // Sit clear of the hand: the hand is pushed up by the home-bar
            // inset on iPhones (--safe-b), so the panel has to rise with it.
            <motion.div
              className="absolute left-0 right-0 z-40"
              style={{ bottom: `calc(${Math.round(hw * 1.4 + 30)}px + var(--safe-b))` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <BidSheet
                minBid={E.minimumBid(view, mySeat, rules)}
                nilAllowed={E.canBidNil(view, mySeat, rules)}
                blindAllowed={rules.blindNil && E.canBidNil(view, mySeat, rules)}
                revealed={!blindPending}
                partnerBid={view.bids[partnerSeat]}
                partnerName={seatPlayer(partnerSeat)?.name ?? 'Partner'}
                suggested={suggested}
                coach={bidCoach}
                busy={busy}
                onReveal={() => setRevealedRound(view.round)}
                onBid={(n, blind) => send({ type: 'bid', bid: n, blind })}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <HandFan
          cards={handCards}
          width={hw}
          deck={deck}
          playable={playable}
          faceDown={blindPending}
          dealKey={dealInfo?.key ?? 0}
          dealer={dealing?.dealer}
          mySeat={mySeat}
          dealStartedAt={dealing?.startedAt}
          dealFrom={dealFrom}
          trumpIds={trumpIds}
          hintId={playCoach?.cardId}
          onPlay={onPlay}
          onBlocked={onBlocked}
          disabled={busy}
        />
      </div>

      {/* overlays */}
      <RoundSummary
        open={view.phase === 'round_over' && !!view.round_result}
        result={view.round_result}
        round={view.round}
        myTeam={myTeam}
        players={players}
        ready={pub.phase === 'round_over' ? pub.ready : view.ready}
        mySeat={mySeat}
        deadline={online ? pub.deadline : null}
        serverNow={serverNow}
        online={online}
        busy={busy}
        onContinue={() => send({ type: 'ready' })}
        coachNotes={coachOn && view.round_result ? roundStory(view.round_result, myTeam, rules, nameOf) : null}
        dealt={roundDealt}
        tally={luck}
        jd={rules.jokers}
      />
      <MatchSummary open={view.phase === 'game_over'} pub={view} myTeam={myTeam} online={online} busy={busy} onRematch={() => send({ type: 'rematch' })} onLeave={leave} players={players} mySeat={mySeat} tally={luck} />

      <TableMenu
        open={menu === 'menu'}
        onClose={() => setMenu(null)}
        muted={muted}
        onToggleMute={toggleMute}
        onDeck={() => setMenu('deck')}
        onTable={() => setMenu('table')}
        onRules={() => setMenu('rules')}
        onProfile={user ? () => setMenu('profile') : undefined}
        coachOn={online ? undefined : coachOn}
        onToggleCoach={online ? undefined : toggleCoach}
        onLeave={leave}
        code={room?.code}
        deckName={deck.name}
        tableName={table.name}
      />
      <RulesSummary open={menu === 'rules'} onClose={() => setMenu('menu')} rules={rules} />
      <DeckPicker
        open={menu === 'deck'}
        selectedId={deck.id}
        onSelect={(d) => {
          // Close first; redrawing the whole table in the new deck can wait a beat.
          setMenu(null)
          startTransition(() => onChangeDeck(d))
        }}
        onClose={() => setMenu('menu')}
      />
      <TablePicker
        open={menu === 'table'}
        selectedId={table.id}
        customTables={customTables}
        onDeleteCustom={onDeleteCustomTable}
        onSelect={(t) => {
          onChangeTable(t)
          setMenu(null)
        }}
        onClose={() => setMenu('menu')}
      />
      {gifsEnabled && (
        <GifSheet
          open={gifOpen}
          userId={user?.id}
          onClose={() => setGifOpen(false)}
          onPick={(pick) => {
            const sent = sendEmote(pick)
            if (sent) setGifOpen(false)
            return sent
          }}
        />
      )}
      {online && (
        <ChatSheet
          open={menu === 'chat'}
          onClose={() => setMenu(null)}
          messages={messages}
          onSend={(text) => {
            const author = players.find((p) => p.id === user?.id)?.name ?? 'You'
            setMessages((m) => [...m, { author, text, mine: true }])
            channelRef.current?.send('CHAT', { author, text })
          }}
          onEmote={(pick) => {
            if (sendEmote(pick)) setMenu(null)
          }}
        />
      )}
      {menu === 'profile' && user && (
        <ProfileModal
          user={user}
          profile={profile}
          onClose={() => setMenu(null)}
          onProfileUpdate={(p) => {
            onProfileUpdate?.(p)
            if (online && room?.id) renameAtTable(room.id, p.username).catch(() => {})
          }}
          onSignOut={() => {
            setMenu(null)
            onSignOut?.()
          }}
        />
      )}

      {/* toasts & rank-up */}
      {/* notices sit just above your hand, clear of the seats and the trick;
          while you're picking or throwing trash talk they move up under the
          score bar instead, so they don't cover it */}
      <div
        className={`pointer-events-none fixed left-1/2 -translate-x-1/2 z-[80] flex ${toastsUp ? 'flex-col' : 'flex-col-reverse'} items-center gap-2 w-[min(92vw,440px)]`}
        style={toastsUp ? { top: 'calc(76px + var(--safe-t))' } : { bottom: `calc(${Math.round(hw * 1.4 + 96 + (coachH ? coachH + 4 : 0))}px + var(--safe-b))` }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="panel-soft rounded-2xl px-4 py-2.5 text-[13px] font-medium text-center flex items-center gap-2"
              style={{ borderColor: t.tone === 'error' ? 'rgb(224 68 46 / 0.6)' : t.tone === 'gold' ? 'rgb(212 166 74 / 0.8)' : 'rgb(241 210 138 / 0.35)', color: t.tone === 'error' ? '#ffb4a6' : t.tone === 'info' ? '#f3eadb' : '#f6dc9a' }}
            >
              {t.icon && <span className="text-base">{t.icon}</span>}
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {levelUp && !rankUp && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLevelUp(null)}>
            <motion.div className="panel rounded-3xl px-10 py-8 text-center" initial={{ scale: 0.5, rotate: 6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <p className="eyebrow">Level up</p>
              <motion.p
                className="font-display text-7xl font-extrabold leading-none mt-2 tabular-nums"
                style={{ color: levelColor(levelUp.level), filter: `drop-shadow(0 0 18px ${levelColor(levelUp.level)})` }}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.1 }}
              >
                {levelUp.level}
              </motion.p>
              <p className="font-display text-xl font-extrabold mt-2" style={{ color: levelColor(levelUp.level) }}>
                {levelUp.newTitle ? `New title: ${levelUp.title}` : levelUp.title}
              </p>
            </motion.div>
          </motion.div>
        )}
        {rankUp && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRankUp(null)}>
            <motion.div className="panel rounded-3xl px-10 py-8 text-center" initial={{ scale: 0.5, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <div className="text-6xl" style={{ filter: `drop-shadow(0 0 18px ${rankUp.color})` }}>
                {rankUp.icon}
              </div>
              <p className="eyebrow mt-3">Rank up</p>
              <p className="font-display text-3xl font-extrabold" style={{ color: rankUp.color }}>
                {rankUp.label}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
