import { useCallback, useEffect, useRef, useState } from 'react'
import {
  POSITIONS,
  dealHands,
  evaluateTrick,
  scoreRound,
  estimateBotBid,
  botCardChoice,
  effectiveSuit,
} from '../lib/cards'
import { updateRoom, mergeGameState, subscribeToRoom, markPlayerLeft, replacePlayerWithBot, openGameChannel, updatePlayerInfo, fetchRoom } from '../lib/rooms'
import PlayerHand from './PlayerHand'
import BidPanel from './BidPanel'
import SeatChip from './SeatChip'
import FaceDownFan from './FaceDownFan'
import VerticalFan from './VerticalFan'
import ScoreBar from './ScoreBar'
import PlayingCard from './PlayingCard'
import DealingAnimationV2 from './DealingAnimationV2'
import RoundOverModal from './RoundOverModal'
import MatchWinnerModal from './MatchWinnerModal'
import PlayerLeftModal from './PlayerLeftModal'
import EmojiReactions from './EmojiReactions'
import GameChat from './GameChat'
import BlindNilPrompt from './BlindNilPrompt'
import GameSettingsSheet from './GameSettingsSheet'
import DeckThemesModal from './DeckThemesModal'
import TableThemesModal from './TableThemesModal'
import ProfileModal from './ProfileModal'
import { useSound, setSoundMuted, isSoundMuted } from '../hooks/useSound'
import { recordMatchResult } from '../lib/auth'
import { checkAndUnlockAchievements, unlockAchievementNow, listFriends } from '../lib/social'
import { TIER_STYLE } from '../data/achievements'
import { rankForRating, rankIndex } from '../data/ranks'

const NEXT_TURN = { bottom: 'left', left: 'top', top: 'right', right: 'bottom' }

// Shown once bidding locks in if the table's four bids don't sum to exactly
// 13 — each a function of the total so the number slots into the joke.
const OVERBID_ROASTS = [
  (total) => `😂 Somebody's lyin' they whole butt off in here — that's ${total} bids on only 13 tricks!`,
  (total) => `🚨 Fraud alert! ${total} bids for 13 tricks?? Y'all cannot ALL be that good.`,
  (total) => `🤡 ${total} combined bids on 13 tricks — bold strategy, let's see how it pans out.`,
  (total) => `📈 Somebody's confidence is writing checks their hand can't cash — ${total} bids, only 13 tricks exist.`,
  (total) => `🎭 ${total} bids on the table for 13 tricks. The Oscar goes to whoever's bluffing hardest.`,
  (total) => `🔥 That's ${total} bids for 13 tricks — this table's about to catch some serious bags.`,
  (total) => `💀 ${total} total bids?? Someone's about to eat a big fat nil-fail today.`,
  (total) => `🎪 Welcome to the circus — ${total} bids on only 13 tricks available.`,
]
const UNDERBID_ROASTS = [
  (total) => `👀 Only ${total} bids on the table for 13 tricks — y'all leavin' free tricks layin' around!`,
  (total) => `😴 ${total} bids total? Somebody's sandbagging hard over here.`,
  (total) => `🕵️ Only ${total} combined bids — who's hiding a monster hand?`,
  (total) => `🙈 ${total} bids for 13 tricks — playing it real safe today, huh?`,
  (total) => `🎯 ${total} total bids, 13 tricks up for grabs — free real estate out here.`,
  (total) => `😬 Nobody trusts their cards today — only ${total} bids on the board.`,
  (total) => `🐢 ${total} bids total... slow and steady, but somebody's leaving points on the table.`,
  (total) => `🧊 Ice cold table — only ${total} bids combined for 13 whole tricks.`,
]

// This app's local phase names ('bidding'/'playing') don't match the
// vocabulary already used in the DB's game_state.phase ('bid'/'play') —
// translate at the persist/hydrate boundary so a value we write doesn't
// come back through realtime and get treated as an unrecognized phase.
const LOCAL_TO_DB_PHASE = { dealing: 'dealing', bidding: 'bid', playing: 'play', result: 'result', game_over: 'game_over' }
const DB_TO_LOCAL_PHASE = { dealing: 'dealing', bid: 'bidding', play: 'playing', result: 'result', game_over: 'game_over' }

function blankBids() {
  return { bottom: null, left: null, top: null, right: null }
}
function blankTricks() {
  return { bottom: 0, left: 0, top: 0, right: 0 }
}
function blankBlind() {
  return { bottom: false, left: false, top: false, right: false }
}
function initialRunningScores() {
  return POSITIONS.reduce((acc, p) => ({ ...acc, [p]: { total: 0, bags: 0 } }), {})
}

// Data keys (hands/bids/tricks/turn) are fixed per room: seat 0 = 'bottom',
// seat 1 = 'left', seat 2 = 'top', seat 3 = 'right' — regardless of who's
// looking at the screen. `toScreenSlot` rotates that fixed frame so each
// viewer always sees their own seat rendered at the bottom.
function seatToDataPos(seat) {
  return POSITIONS[((seat % 4) + 4) % 4]
}
function toScreenSlot(dataPos, mySeat) {
  const i = POSITIONS.indexOf(dataPos)
  return POSITIONS[(i - mySeat + 4) % 4]
}

export default function GameTable({
  mode = 'solo',
  players = { bottom: { username: 'You' }, left: { username: 'Bot 1', isBot: true }, top: { username: 'Bot 2', isBot: true }, right: { username: 'Bot 3', isBot: true } },
  settings = {},
  tableTheme,
  deckTheme,
  onChangeTableTheme,
  onChangeDeckTheme,
  room,
  myUserId,
  authUser,
  profile,
  onProfileUpdate,
  onSignOut,
  mySeat = 0,
  onExit,
}) {
  const accentColor = tableTheme?.accentColor ?? '#a78bfa'
  const winScore = settings.winScore ?? 500
  const useJD = !!settings.jokersWild
  const spadesBreakRule = settings.spadesBreakRule !== false
  const isMultiplayer = mode === 'multiplayer' && !!room
  const isHost = !isMultiplayer || room.host_id === myUserId
  const MY_POS = seatToDataPos(mySeat)
  const myTeam = MY_POS === 'bottom' || MY_POS === 'top' ? 'A' : 'B'
  const PARTNER_POS = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' }[MY_POS]

  const [phase, setPhase] = useState('dealing')
  const [hands, setHands] = useState({})
  const [bids, setBids] = useState(blankBids())
  const [tricks, setTricks] = useState(blankTricks())
  const [bags, setBags] = useState({ bottom: 0, left: 0, top: 0, right: 0 })
  const [currentTrick, setCurrentTrick] = useState([])
  const [turn, setTurn] = useState('bottom')
  const [ledSuit, setLedSuit] = useState(null)
  const [spadesBroken, setSpadesBroken] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [runningScores, setRunningScores] = useState(initialRunningScores())
  const [roundDetail, setRoundDetail] = useState(null)
  const [matchWinner, setMatchWinner] = useState(null)
  const [wasMoonShot, setWasMoonShot] = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [rankUp, setRankUp] = useState(null)
  const matchRecordedRef = useRef(false)
  // Tracks MY_POS's consecutive trick wins for the live "Walk Em Down"
  // achievement — this must work identically for host and guest alike, so
  // unlike host-authoritative trick evaluation it's driven purely by
  // watching the already-synced `tricks` state change, not by evaluating
  // who won locally.
  const prevTricksRef = useRef(tricks)
  const consecutiveTricksRef = useRef(0)
  const roundAchievementNonceRef = useRef(-1)
  // Largest point deficit MY team has faced at any point in the match, for
  // the "Comeback King" achievement — updated every time a round's scores
  // land, on every client (running_scores is already synced via hydrate).
  const maxDeficitRef = useRef(0)
  const [trickWinnerFlash, setTrickWinnerFlash] = useState(null)
  const [emotes, setEmotes] = useState({})
  const [chatMessages, setChatMessages] = useState([])
  const [dealNonce, setDealNonce] = useState(0)
  const [muted, setMuted] = useState(isSoundMuted())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deckPickerOpen, setDeckPickerOpen] = useState(false)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const [blindNil, setBlindNil] = useState(blankBlind())
  const [revealed, setRevealed] = useState({})
  const [livePlayers, setLivePlayers] = useState(players)
  const [leftPlayerPos, setLeftPlayerPos] = useState(null)
  const knownPlayerIdsRef = useRef(null)
  const livePlayersRef = useRef(players)
  useEffect(() => {
    livePlayersRef.current = livePlayers
  }, [livePlayers])
  const [errorToast, setErrorToast] = useState(null)
  const [boardNotice, setBoardNotice] = useState(null)
  const [totalBidNotice, setTotalBidNotice] = useState(null)
  const prevPhaseRef = useRef(phase)
  // Read via ref (not a dependency) in the totalBidNotice effect below — see
  // that effect's comment for why depending on `bids` directly leaves the
  // notice stuck on screen forever.
  const bidsRef = useRef(bids)
  bidsRef.current = bids

  function showError(message) {
    playError()
    setErrorToast(message)
    setTimeout(() => setErrorToast((cur) => (cur === message ? null : cur)), 6000)
  }

  useEffect(() => {
    if (!newAchievements.length) return
    playFanfare()
    const t = setTimeout(() => setNewAchievements([]), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAchievements])

  useEffect(() => {
    if (!rankUp) return
    playFanfare()
    const t = setTimeout(() => setRankUp(null), 7000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankUp])

  // "Walk Em Down" — win 4 tricks in a row. Fires the instant it happens
  // (not at match end) by watching whichever position's count in the
  // already-synced `tricks` state just went up; this works the same for
  // host and guest since it never depends on locally evaluating the trick.
  useEffect(() => {
    const prev = prevTricksRef.current
    prevTricksRef.current = tricks
    const wonPos = POSITIONS.find((p) => (tricks[p] ?? 0) > (prev[p] ?? 0))
    if (!wonPos) return
    if (wonPos !== MY_POS) {
      consecutiveTricksRef.current = 0
      return
    }
    consecutiveTricksRef.current += 1
    if (consecutiveTricksRef.current === 4 && myUserId) {
      unlockAchievementNow(myUserId, 'walk_em_down').then((result) => {
        if (result) setNewAchievements((cur) => [...cur, result])
      })
    }
  }, [tricks, MY_POS, myUserId])

  const playShuffle = useSound('shuffle')
  const playBid = useSound('bid')
  const playCardSfx = useSound('cardPlay')
  const playTrickWin = useSound('trickWin')
  const playFanfare = useSound('fanfare')
  const playError = useSound('error')

  const pendingTrickRef = useRef(false)
  const roundCompleteRef = useRef(-1)
  // Caps the "board rule" (min combined team bid) rebid loop at one attempt.
  // Without a cap, a team paired with a bot whose hand-based bid estimate is
  // deterministic (same hand -> same estimate every rebid) can never clear
  // the minimum, and the round never advances past bidding — from the
  // player's side that looks exactly like the game freezing. Reset to 0 at
  // the start of every deal.
  const boardRuleAttemptRef = useRef(0)
  // Guards against a rapid double-tap/double-click playing two cards for the
  // same turn: playCard reads currentTrick/ledSuit/spadesBroken from the
  // render closure rather than a functional update, so two calls firing
  // before React re-renders between them would both see the same stale
  // currentTrick and could both append to it — corrupting the trick (e.g. a
  // duplicate seat entry) in a way evaluateTrick can't cleanly resolve,
  // stalling the game. Cleared once `turn` actually changes.
  const playingCardRef = useRef(false)
  // Guards the initial-mount deal so it can only ever fire once per
  // component instance — React Strict Mode's dev-only double-invoke of a
  // fresh effect would otherwise call startDeal() twice, dealing two
  // different shuffles that race to persist over each other.
  const initialDealDoneRef = useRef(false)
  const roomIdRef = useRef(room?.id)
  roomIdRef.current = room?.id

  // Mirrors the full game_state we last applied, so a partial local change
  // (one bid, one card) can be persisted as a complete jsonb blob.
  const gameStateRef = useRef({})

  // Concurrent writers (bot timers, plus whichever of the 4 seats are real
  // players) each patch only the keys they're changing. A plain `update
  // rooms set game_state = $1` from the client would be a whole-column
  // overwrite with no per-key concurrency control, so two players bidding
  // around the same moment can silently drop each other's bid. Persisting
  // through the merge_room_game_state RPC does the deep merge atomically
  // on the server instead. Writes from this client are also chained
  // through writeQueueRef so they reach the server in the order issued.
  const writeQueueRef = useRef(Promise.resolve())
  // Timestamp of this client's own last persist() call — read by the general
  // self-heal poll below so it never re-hydrates from a `fetchRoom` snapshot
  // that raced ahead of (i.e. was read before) a write this same client just
  // issued. Without this guard, a poll landing in the gap between "we called
  // persist()" and "that write actually committed" would read a pre-write
  // row and briefly roll this client's own fresh move back on screen.
  const lastPersistAtRef = useRef(0)

  function persist(patch) {
    const dbPatchState = patch.phase ? { ...patch, phase: LOCAL_TO_DB_PHASE[patch.phase] ?? patch.phase } : patch
    gameStateRef.current = { ...gameStateRef.current, ...dbPatchState }
    if (isMultiplayer && roomIdRef.current) {
      lastPersistAtRef.current = Date.now()
      if (dbPatchState.phase && dbPatchState.phase !== 'dealing' && room.status === 'waiting') {
        updateRoom(roomIdRef.current, { status: 'playing' }).catch(() => {})
      }
      writeQueueRef.current = writeQueueRef.current.then(() => persistWithRetry(dbPatchState))
    }
  }

  // A failed write gets one silent retry after 3s (DB hiccup / flaky
  // connection); only a second failure surfaces to the player, since most
  // transient errors resolve on their own before the retry even fires.
  function persistWithRetry(dbPatchState, isRetry = false) {
    return mergeGameState(roomIdRef.current, dbPatchState).catch(() => {
      if (isRetry) {
        showError('Connection issue — some moves may not have synced. Retrying…')
        return
      }
      return new Promise((resolve) => {
        setTimeout(() => resolve(persistWithRetry(dbPatchState, true)), 3000)
      })
    })
  }

  // Standard Spades dealer rotation: the deal passes one seat to the left
  // each hand, and the player to the dealer's left always leads the first
  // trick — which, since teams alternate seats around the table (A/B/A/B),
  // is exactly the same as saying "the opposite team leads" whenever the
  // dealer is on your own side. `dealerRef` tracks whoever dealt the *last*
  // hand; the room's creator deals hand 1 (defaulting to 'bottom'), and each
  // startDeal() rotates it to that hand's leader — since the seat that led
  // is, by definition, the seat to the old dealer's left, which is exactly
  // where the deal passes to next. Persisted as `dealer` so a host reload
  // mid-game (or a guest, kept in sync via hydrate) doesn't reset rotation
  // back to 'bottom'.
  const dealerRef = useRef('bottom')

  const startDeal = useCallback(() => {
    playShuffle()
    const nextHands = dealHands(useJD)
    const leader = NEXT_TURN[dealerRef.current]
    setHands(nextHands)
    setBids(blankBids())
    setTricks(blankTricks())
    prevTricksRef.current = blankTricks()
    consecutiveTricksRef.current = 0
    setCurrentTrick([])
    setTurn(leader)
    setLedSuit(null)
    setSpadesBroken(false)
    setSelectedCard(null)
    setRoundDetail(null)
    setPhase('dealing')
    setDealNonce((n) => n + 1)
    setBlindNil(blankBlind())
    setRevealed({})
    boardRuleAttemptRef.current = 0
    if (!isMultiplayer || isHost) {
      persist({
        hands: nextHands,
        bids: blankBids(),
        tricks: blankTricks(),
        current_trick: [],
        current_turn: leader,
        dealer: dealerRef.current,
        led_suit: null,
        spades_broken: false,
        round_detail: null,
        blind_nil: blankBlind(),
        phase: 'dealing',
        round: (gameStateRef.current.round ?? 0) + 1,
      })
    }
    dealerRef.current = leader
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useJD, isMultiplayer, isHost])

  useEffect(() => {
    if (initialDealDoneRef.current) return
    initialDealDoneRef.current = true
    if (!isMultiplayer) {
      startDeal()
    } else if (Object.keys(room.game_state ?? {}).length === 0 && isHost) {
      startDeal()
    } else if (room.game_state) {
      hydrate(room.game_state)
    }
    if (isMultiplayer && room?.players) {
      const ids = {}
      room.players.forEach((p) => {
        ids[seatToDataPos(p.seat)] = p.id
      })
      knownPlayerIdsRef.current = ids
      lastPlayersRawRef.current = JSON.stringify(room.players)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hydrate(gs) {
    gameStateRef.current = gs
    if (gs.hands) setHands(gs.hands)
    if (gs.bids) setBids(gs.bids)
    if (gs.tricks) setTricks(gs.tricks)
    setCurrentTrick(gs.current_trick ?? [])
    // current_turn is intentionally null while a completed trick is pending
    // evaluation (see playCard) — `?? 'bottom'` would silently coerce that
    // null into a real seat, wrongly re-enabling someone's turn (always
    // 'bottom' on the very next realtime echo of this client's own write)
    // and letting an extra card get appended to an already-complete trick.
    // Only fall back to 'bottom' when the field is truly absent.
    setTurn(gs.current_turn === undefined ? 'bottom' : gs.current_turn)
    if (gs.dealer) dealerRef.current = gs.dealer
    setLedSuit(gs.led_suit ?? null)
    setSpadesBroken(!!gs.spades_broken)
    if (gs.blind_nil) setBlindNil(gs.blind_nil)
    setRoundDetail(gs.round_detail ?? null)
    if (gs.running_scores) setRunningScores(gs.running_scores)
    if (gs.phase) setPhase(DB_TO_LOCAL_PHASE[gs.phase] ?? gs.phase)
    if (typeof gs.round === 'number') setDealNonce(gs.round)
  }

  // Self-heal against a missed realtime event. A non-host client depends
  // entirely on the host's postgres_changes broadcast to leave 'dealing' —
  // it never runs handleDealComplete itself. If that one event is dropped
  // (a subscription that was still connecting the instant the host's write
  // landed, a flaky connection, etc.) there's normally no retry and the
  // client is stuck on the dealing animation forever, looking like a blank
  // game. If we're still in 'dealing' well past the ~4.5s animation, fetch
  // the room directly (bypassing realtime) and hydrate from that instead.
  useEffect(() => {
    if (!isMultiplayer || !room?.id) return
    if (phase !== 'dealing') return
    if (isHost) return
    const t = setTimeout(async () => {
      const fresh = await fetchRoom(room.id)
      if (fresh?.game_state) hydrate(fresh.game_state)
    }, 7000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, room?.id, phase, isHost])

  // Applies a fresh `players` array (from either a realtime echo or a direct
  // poll) to livePlayers/knownPlayerIdsRef — shared so both paths converge
  // on the same seat map instead of drifting from two different code paths.
  const lastPlayersRawRef = useRef(null)
  function syncPlayers(playersArr) {
    if (!playersArr) return
    lastPlayersRawRef.current = JSON.stringify(playersArr)
    const newIds = {}
    playersArr.forEach((p) => {
      newIds[seatToDataPos(p.seat)] = p.id
    })
    const prevIds = knownPlayerIdsRef.current
    if (prevIds) {
      for (const pos of POSITIONS) {
        // A seat's human can go away two ways: their entry disappears
        // entirely (the pre-game leaveRoom path), or — mid-game — it stays
        // but flips `left: true` (markPlayerLeft), so the seat/hand/turn
        // state survives for a possible reconnect. Both should offer the
        // same "replace with bot?" prompt to everyone else.
        const wasHuman = prevIds[pos] && !livePlayersRef.current[pos]?.isBot
        const stillThereNow = playersArr.find((p) => seatToDataPos(p.seat) === pos)
        const nowGoneOrLeft = !newIds[pos] || (stillThereNow?.left && !livePlayersRef.current[pos]?.left)
        if (wasHuman && nowGoneOrLeft) {
          setLeftPlayerPos((cur) => cur ?? pos)
        }
      }
    }
    knownPlayerIdsRef.current = newIds
    setLivePlayers((prev) => {
      const next = { ...prev }
      playersArr.forEach((p) => {
        const pos = seatToDataPos(p.seat)
        next[pos] = { ...next[pos], username: p.name, isBot: !!p.isBot, left: !!p.left }
      })
      return next
    })
  }

  // Multiplayer: mirror remote room state.
  useEffect(() => {
    if (!isMultiplayer || !room?.id) return
    const sub = subscribeToRoom(room.id, (updatedRoom) => {
      if (updatedRoom.game_state) hydrate(updatedRoom.game_state)
      if (updatedRoom.players) syncPlayers(updatedRoom.players)
    })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, room?.id])

  // General self-heal poll: any client (host included — a guest's card play
  // or bid is written directly by that guest and only reaches everyone else,
  // host included, as a postgres_changes echo) can miss a realtime event on
  // a flaky connection and silently stop advancing while chat/emoji (a
  // separate broadcast channel) keep working — the exact "stuck on an old
  // turn while everyone else has moved on" symptom. Every few seconds,
  // compare the server's actual game_state/players against what's currently
  // applied and re-hydrate if they've drifted, so no client can stay stuck
  // for more than a few seconds no matter which event got dropped.
  useEffect(() => {
    if (!isMultiplayer || !room?.id) return
    const interval = setInterval(async () => {
      const fresh = await fetchRoom(room.id)
      if (!fresh) return
      // Skip if we issued our own write in the last 2.5s — `fresh` may have
      // been read before that write committed, and applying it would roll
      // our own just-made move back on screen (see lastPersistAtRef above).
      if (Date.now() - lastPersistAtRef.current < 2500) return
      if (fresh.game_state && JSON.stringify(fresh.game_state) !== JSON.stringify(gameStateRef.current)) {
        hydrate(fresh.game_state)
      }
      if (fresh.players && JSON.stringify(fresh.players) !== lastPlayersRawRef.current) {
        syncPlayers(fresh.players)
      }
    }, 4000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, room?.id])

  // Auto-dismiss the "player left" prompt once that seat has been replaced
  // with a bot, or the human reconnects on their own (rejoinRoomById /
  // joinRoomByCode clear the `left` flag — see lib/rooms.js). Checks the
  // seat is actually still present before trusting its `left` flag — a
  // position that's disappeared from `players` entirely keeps whatever
  // stale `left`/`isBot` values it last had, which would otherwise read as
  // "reconnected" and dismiss the prompt for a seat nobody ever fixed.
  useEffect(() => {
    if (!leftPlayerPos) return
    const stillPresent = !!knownPlayerIdsRef.current?.[leftPlayerPos]
    const info = livePlayers[leftPlayerPos]
    if (info?.isBot || (stillPresent && !info?.left)) {
      setLeftPlayerPos(null)
    }
  }, [livePlayers, leftPlayerPos])

  function handleReplaceBot() {
    if (!leftPlayerPos) return
    const pos = leftPlayerPos
    setLivePlayers((prev) => ({ ...prev, [pos]: { ...prev[pos], isBot: true } }))
    if (isMultiplayer && room?.id) {
      replacePlayerWithBot(room.id, POSITIONS.indexOf(pos)).catch(() => {})
    }
    setLeftPlayerPos(null)
  }

  // Low-latency fan-out for taunts/chat so other clients see them without
  // waiting on a postgres_changes round-trip (these never touch game_state).
  const gameChannelRef = useRef(null)
  useEffect(() => {
    if (!isMultiplayer || !room?.id) return
    const channel = openGameChannel(room.id, {
      EMOTE: ({ pos, emoji }) => showEmote(pos, emoji),
      CHAT: ({ author, text }) => setChatMessages((prev) => [...prev, { author, text }]),
    })
    gameChannelRef.current = channel
    return () => {
      gameChannelRef.current = null
      channel.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, room?.id])

  function handleDealComplete() {
    if (isMultiplayer && !isHost) return
    setPhase('bidding')
    persist({ phase: 'bidding' })
  }

  // Bot bidding — host authoritative in multiplayer, always-on in solo.
  useEffect(() => {
    if (phase !== 'bidding') return
    if (isMultiplayer && !isHost) return
    const nilEnabled = settings.standardNil !== false
    const timers = []
    for (const pos of POSITIONS) {
      const player = livePlayers[pos]
      if (player?.isBot && bids[pos] === null) {
        const t = setTimeout(() => {
          setBids((prev) => {
            if (prev[pos] !== null) return prev
            // No hard cap here on purpose — real Spades bidding lets the
            // table land over or under 13 combined, which is what makes a
            // round swingy. estimateBotBid still reads the bot's actual
            // hand strength so it isn't reckless, just not artificially
            // capped to whatever's technically still available.
            const bid = estimateBotBid(hands[pos] ?? [], nilEnabled, useJD)
            persist({ bids: { [pos]: bid } })
            playBid()
            return { ...prev, [pos]: bid }
          })
        }, 400 + Math.random() * 900)
        timers.push(t)
      }
    }
    return () => timers.forEach(clearTimeout)
    // `bids` must stay a dependency: the board-rule effect can reset a
    // bot's bid back to null for a rebid without touching phase/hands, and
    // without re-running here that bot would never get a new bid timer
    // scheduled — stuck at "no bid" forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hands, livePlayers, settings.standardNil, isMultiplayer, isHost, bids])

  // Transition bidding -> playing once all bids in (host-only in multiplayer).
  // "Board rule": a partnership's combined bid must reach the minimum
  // (classically 4) — if not, both partners' bids are cleared and they must
  // rebid, rather than silently starting play under the minimum.
  useEffect(() => {
    if (phase !== 'bidding') return
    if (isMultiplayer && !isHost) return
    if (!POSITIONS.every((p) => bids[p] !== null)) return

    const boardRuleOn = settings.boardRule !== false && settings.partnershipMode !== false
    if (boardRuleOn) {
      const boardMin = settings.boardMinimum ?? 4
      const teams = [
        { pos: ['bottom', 'top'], total: bids.bottom + bids.top },
        { pos: ['left', 'right'], total: bids.left + bids.right },
      ]
      const short = teams.find((t) => t.total < boardMin)
      // Capped at one rebid attempt per deal. A bot's bid estimate is
      // deterministic for a given hand (only its nil coin-flip varies), so a
      // team paired with a weak-handed bot can be mathematically incapable
      // of ever reaching the minimum — without this cap that team's bids get
      // cleared and re-submitted forever, bidding never locks in, and the
      // round (and therefore the whole game) never advances. One rebid still
      // gives a human a chance to correct an accidental low bid; if the team
      // is still short after that, play proceeds under the minimum instead
      // of looping.
      if (short && boardRuleAttemptRef.current < 1) {
        boardRuleAttemptRef.current += 1
        const mine = short.pos.includes(MY_POS)
        setBoardNotice(`${mine ? 'Your team' : 'Opponents'} bid only ${short.total} combined — must bid at least ${boardMin}. Rebidding…`)
        setTimeout(() => setBoardNotice(null), 4500)
        const clearedBids = { ...bids, [short.pos[0]]: null, [short.pos[1]]: null }
        setBids(clearedBids)
        persist({ bids: { [short.pos[0]]: null, [short.pos[1]]: null } })
        return
      }
    }

    const t = setTimeout(() => {
      setPhase('playing')
      persist({ phase: 'playing' })
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bids, isMultiplayer, isHost])

  // Call out a wildly over- or under-confident table the moment bidding
  // locks in. Runs identically on every client (host and guests) off their
  // own already-synced `bids` — no persistence needed — and fires exactly
  // once per round by keying off the 'bidding' -> 'playing' transition,
  // which only happens after any board-rule rebid has already resolved.
  // The message is picked deterministically from `dealNonce` + the total
  // (both already synced) rather than Math.random(), so every client shows
  // the same joke for the same round while still varying round to round.
  //
  // Deliberately depends on [phase, dealNonce] only, NOT `bids` — a realtime
  // echo can hand back a `bids` object with identical values but a new
  // reference (e.g. on the host, which sees more echoes of its own writes).
  // If `bids` were a dependency, that reference change would re-run this
  // effect; the cleanup would cancel the pending dismiss timer, and the
  // `prevPhase === 'playing'` guard (already true by then) would return
  // early without scheduling a new one — leaving the notice stuck on screen
  // forever instead of clearing after its timeout. `bids` is read from a
  // ref instead so the notice text is still correct without that hazard.
  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase !== 'playing' || prevPhase === 'playing') return
    const currentBids = bidsRef.current
    const total = POSITIONS.reduce((sum, p) => sum + (currentBids[p] ?? 0), 0)
    if (total === 13) return
    const pool = total > 13 ? OVERBID_ROASTS : UNDERBID_ROASTS
    const index = (dealNonce * 7 + total * 3) % pool.length
    setTotalBidNotice(pool[index](total))
    const t = setTimeout(() => setTotalBidNotice(null), 10000)
    return () => clearTimeout(t)
  }, [phase, dealNonce])

  const isMyTurn = phase === 'playing' && turn === MY_POS
  const blindNilEnabled = !!settings.blindNil
  const myRevealed = !blindNilEnabled || !!revealed[MY_POS]
  const awaitingBlindDecision = phase === 'bidding' && blindNilEnabled && bids[MY_POS] === null && !revealed[MY_POS]

  function chooseBlindNil() {
    setBlindNil((prev) => ({ ...prev, [MY_POS]: true }))
    setRevealed((prev) => ({ ...prev, [MY_POS]: true }))
    setBids((prev) => ({ ...prev, [MY_POS]: 0 }))
    persist({ blind_nil: { [MY_POS]: true }, bids: { [MY_POS]: 0 } })
    playBid()
  }

  function revealHand() {
    setRevealed((prev) => ({ ...prev, [MY_POS]: true }))
  }

  function playCard(pos, card) {
    if (playingCardRef.current) return
    playingCardRef.current = true
    // Belt-and-suspenders: the [turn] effect below clears this in the
    // normal case, but if anything unexpected prevents turn from changing,
    // this guarantees the guard can't wedge the game open indefinitely.
    setTimeout(() => {
      playingCardRef.current = false
    }, 3000)
    playCardSfx()

    // Compute all derived state up front from the render closure (playingCardRef
    // already guards re-entrancy) instead of inside a setHands(prev => ...)
    // updater. React Strict Mode intentionally invokes updater functions twice
    // in dev to catch impure updaters — an updater that calls other setters and
    // persist() as side effects (as this used to) fires those side effects
    // twice per card play, double-persisting and double-appending to the trick.
    const nextHands = { ...hands, [pos]: hands[pos].filter((c) => c.id !== card.id) }
    const nextTrick = [...currentTrick, { pos, card }]
    const nextLedSuit = nextTrick.length === 1 ? effectiveSuit(card, useJD) : ledSuit
    const nextSpadesBroken = spadesBroken || effectiveSuit(card, useJD) === 'S'
    // When this card completes the trick, don't hand the turn to the fixed
    // rotation's next seat yet — the trick-evaluation effect below decides
    // the real next turn (the trick winner) ~1200ms later, once the card
    // animation and evaluateTrick() have run. Advancing turn immediately via
    // NEXT_TURN[pos] here made that seat's hand briefly (and wrongly) play-
    // able while the trick still visually held 4 cards; a real tap in that
    // window let a 5th card get appended to an already-complete trick, which
    // the trick-evaluation effect's `currentTrick.length !== 4` guard can
    // never match again — freezing the game with cards stuck on the table.
    const nextTurn = nextTrick.length === 4 ? null : NEXT_TURN[pos]

    setHands(nextHands)
    setCurrentTrick(nextTrick)
    setLedSuit(nextLedSuit)
    setSpadesBroken(nextSpadesBroken)
    setTurn(nextTurn)
    persist({
      hands: { [pos]: nextHands[pos] },
      current_trick: nextTrick,
      led_suit: nextLedSuit,
      spades_broken: nextSpadesBroken,
      current_turn: nextTurn,
    })
    setSelectedCard(null)
  }

  // Releases the double-play guard once the turn has actually advanced —
  // covers both a successful play and a hydrate() from a remote update.
  useEffect(() => {
    playingCardRef.current = false
  }, [turn])

  function handleMyCardClick(card) {
    if (!isMyTurn) return
    playCard(MY_POS, card)
  }

  // Bot card play — host authoritative in multiplayer.
  useEffect(() => {
    if (phase !== 'playing') return
    if (isMultiplayer && !isHost) return
    const player = livePlayers[turn]
    if (!player?.isBot) return
    if (currentTrick.length === 4) return
    const t = setTimeout(() => {
      const hand = hands[turn] ?? []
      if (!hand.length) return
      const card = botCardChoice(hand, currentTrick, spadesBroken, ledSuit, useJD, spadesBreakRule, { pos: turn, bids, tricksTaken: tricks })
      if (card) playCard(turn, card)
    }, 600 + Math.random() * 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, hands, currentTrick, isMultiplayer, isHost])

  // Evaluate trick once 4 cards played — host authoritative in multiplayer.
  useEffect(() => {
    if (phase !== 'playing') return
    if (isMultiplayer && !isHost) return
    if (currentTrick.length !== 4) return
    if (pendingTrickRef.current) return
    pendingTrickRef.current = true
    const winnerPos = evaluateTrick(currentTrick, useJD)
    const t = setTimeout(() => {
      playTrickWin()
      setTrickWinnerFlash(winnerPos)
      // Computed from the render closure (this 1200ms timeout only ever
      // fires once per trick, guarded by pendingTrickRef) rather than a
      // setTricks(prev => ...) updater with persist() inside it — same
      // reasoning as the running-score fix above: a side effect inside an
      // updater isn't guaranteed to run exactly once at a predictable time.
      const nextTricks = { ...tricks, [winnerPos]: tricks[winnerPos] + 1 }
      setTricks(nextTricks)
      persist({ tricks: nextTricks, current_trick: [], led_suit: null, current_turn: winnerPos })
      setTurn(winnerPos)
      setCurrentTrick([])
      setLedSuit(null)
      pendingTrickRef.current = false
      setTimeout(() => setTrickWinnerFlash(null), 700)
    }, 1200)
    // If this effect re-runs (e.g. React Strict Mode's dev-only double-invoke
    // of a fresh effect, or any other dep change) before the timeout above
    // fires, the cleanup must release the guard too — otherwise the pending
    // timer gets cancelled but pendingTrickRef.current is left permanently
    // true, so this effect's own `if (pendingTrickRef.current) return` bails
    // out on every future run and the trick can never be evaluated again
    // (cards stuck on the table, turn never advances, game freezes).
    return () => {
      clearTimeout(t)
      pendingTrickRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTrick, useJD, isMultiplayer, isHost])

  // Round complete after 13 tricks — host authoritative in multiplayer.
  // `roundCompleteRef` guards against processing the same round twice: this
  // effect depends on `tricks`, and a realtime echo of the host's own last
  // trick-win write can hand back a `tricks` object with identical values
  // but a new reference, re-satisfying every guard below (phase is still
  // 'playing' at that instant, total is still 13, currentTrick is still
  // empty) and re-running the whole round score calculation a second time —
  // doubling the running total and the persisted round detail. Keyed by
  // `dealNonce` so it naturally resets for each new round without needing
  // an explicit reset call.
  useEffect(() => {
    if (phase !== 'playing') return
    if (isMultiplayer && !isHost) return
    const total = POSITIONS.reduce((sum, p) => sum + tricks[p], 0)
    if (total !== 13) return
    if (currentTrick.length !== 0) return
    if (roundCompleteRef.current === dealNonce) return
    roundCompleteRef.current = dealNonce
    const detail = scoreRound(bids, tricks, bags, settings, blindNil)
    setRoundDetail(detail)
    // Computed directly from the render-closure `bags`/`runningScores`
    // (this effect's own `roundCompleteRef` guard already makes that safe)
    // instead of inside a setXxx(prev => ...) updater — a functional
    // updater's callback isn't guaranteed to run synchronously, so a value
    // assigned inside one and read immediately after (as `nextRunning` used
    // to be, for the persist() call below) can still be undefined at that
    // point. React's own state still ends up correct either way, which is
    // why this only ever broke the DB write — host's own screen looked
    // fine while every other client received `running_scores: undefined`
    // and could never show a real score.
    const nextBags = { ...bags }
    const nextRunning = { ...runningScores }
    POSITIONS.forEach((p) => {
      nextBags[p] = detail[p].bags
      nextRunning[p] = { total: runningScores[p].total + detail[p].score, bags: detail[p].bags }
    })
    setBags(nextBags)
    setRunningScores(nextRunning)
    playFanfare()

    // Moon Shot: a partnership sweeping all 13 tricks in one hand wins instantly.
    let moonShotWinner = null
    if (settings.moonShot && settings.partnershipMode !== false) {
      if (tricks.bottom + tricks.top === 13) moonShotWinner = myTeam === 'A' ? 'You & Partner' : 'Opponents'
      else if (tricks.left + tricks.right === 13) moonShotWinner = myTeam === 'B' ? 'You & Partner' : 'Opponents'
    }

    const roundPatch = {
      round_detail: detail,
      round_scores: POSITIONS.reduce((acc, p) => ({ ...acc, [p]: detail[p].score }), {}),
      running_scores: nextRunning,
    }
    if (moonShotWinner) {
      setMatchWinner(moonShotWinner)
      setWasMoonShot(true)
      setPhase('game_over')
      persist({ ...roundPatch, phase: 'game_over' })
    } else {
      setPhase('result')
      persist({ ...roundPatch, phase: 'result' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tricks, currentTrick, isMultiplayer, isHost])

  // Round-scope achievements (Nil Master, Blindfolded, Sharpshooter, High
  // Roller) — checked from MY_POS's own round line, on every client (not
  // host-gated) since `roundDetail`/`blindNil` are already synced via
  // hydrate. `roundAchievementNonceRef` guards against re-checking the same
  // round on a redundant re-render.
  useEffect(() => {
    if (!roundDetail || !myUserId) return
    if (roundAchievementNonceRef.current === dealNonce) return
    roundAchievementNonceRef.current = dealNonce
    const mine = roundDetail[MY_POS]
    if (!mine) return
    const partner = roundDetail[PARTNER_POS]
    checkAndUnlockAchievements(myUserId, 'round', {
      bid: mine.bid,
      taken: mine.taken,
      blindNil: !!blindNil[MY_POS],
      partnerBid: partner?.bid,
      partnerTaken: partner?.taken,
    }).then((newly) => {
      if (newly.length) setNewAchievements((cur) => [...cur, ...newly])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDetail, dealNonce, myUserId])

  useEffect(() => {
    const myTotal = runningScores[MY_POS]?.total ?? 0
    const oppPos = myTeam === 'A' ? 'left' : 'bottom'
    const oppTotal = runningScores[oppPos]?.total ?? 0
    maxDeficitRef.current = Math.max(maxDeficitRef.current, oppTotal - myTotal)
  }, [runningScores, MY_POS, myTeam])

  useEffect(() => {
    if (phase !== 'result' || !runningScores) return
    if (isMultiplayer && !isHost) return
    const partnership = settings.partnershipMode !== false
    if (partnership) {
      // Under team-combined scoring both partners already carry the SAME
      // shared total (see scoreTeam in lib/cards.js) — summing them here
      // would double-count a single team outcome as if two independent
      // scores existed, both inflating the displayed score and making a
      // match end at half the real target.
      const teamA = runningScores.bottom.total
      const teamB = runningScores.left.total
      if (teamA >= winScore || teamB >= winScore) {
        const winningTeam = teamA >= winScore ? 'A' : 'B'
        setMatchWinner(winningTeam === myTeam ? 'You & Partner' : 'Opponents')
        setPhase('game_over')
        persist({ phase: 'game_over' })
        playFanfare()
      }
    } else {
      const winnerPos = POSITIONS.find((p) => runningScores[p].total >= winScore)
      if (winnerPos) {
        setMatchWinner(livePlayers[winnerPos]?.username ?? winnerPos)
        setPhase('game_over')
        persist({ phase: 'game_over' })
        playFanfare()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isMultiplayer, isHost])

  // Record this match to the signed-in player's own history/stats and check
  // for newly-earned achievements. Runs once per client (each real player
  // records their own result independently) — a ref guards against re-firing
  // on re-renders while phase stays 'game_over'.
  useEffect(() => {
    if (phase !== 'game_over' || !myUserId || matchRecordedRef.current) return
    matchRecordedRef.current = true
    const partnership = settings.partnershipMode !== false
    let won, yourScore, opponentScore
    if (partnership) {
      // Same reasoning as the win-condition check above: both partners
      // share one total under team-combined scoring, so don't sum them.
      const teamA = runningScores.bottom.total
      const teamB = runningScores.left.total
      yourScore = myTeam === 'A' ? teamA : teamB
      opponentScore = myTeam === 'A' ? teamB : teamA
    } else {
      yourScore = runningScores[MY_POS]?.total ?? 0
      opponentScore = Math.max(0, ...POSITIONS.filter((p) => p !== MY_POS).map((p) => runningScores[p]?.total ?? 0))
    }
    won = yourScore > opponentScore
    const ratingBefore = profile?.elo_rating ?? 1200
    recordMatchResult(myUserId, { won, yourScore, opponentScore, rounds: dealNonce }).then((updatedProfile) => {
      if (!updatedProfile) return
      onProfileUpdate?.(updatedProfile)
      const before = rankForRating(ratingBefore)
      const after = rankForRating(updatedProfile.elo_rating ?? 1200)
      if (after.id !== before.id && rankIndex(after.id) > rankIndex(before.id)) {
        setRankUp(after)
      }
      listFriends(myUserId).then(({ friends }) => {
        checkAndUnlockAchievements(myUserId, 'match', {
          won,
          marginOfVictory: yourScore - opponentScore,
          moonShot: wasMoonShot,
          profile: updatedProfile,
          friendCount: friends.length,
          maxDeficit: maxDeficitRef.current,
        }).then((newly) => {
          if (newly.length) setNewAchievements((cur) => [...cur, ...newly])
        })
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, myUserId])

  function getSeatLabel(pos) {
    return livePlayers[pos]?.username ?? pos
  }

  function toggleMute() {
    setMuted((m) => {
      setSoundMuted(!m)
      return !m
    })
  }

  // A username/avatar edit made mid-game needs to reach every other player's
  // screen immediately, not just take effect the next time this player joins
  // a room — so in addition to updating the shared profile record, push the
  // change straight into this room's live players[] too.
  function handleProfileUpdate(updatedProfile) {
    onProfileUpdate?.(updatedProfile)
    if (isMultiplayer && room?.id && myUserId) {
      updatePlayerInfo(room.id, myUserId, { name: updatedProfile.username, avatar_url: updatedProfile.avatar_url }).catch(() => {})
      setLivePlayers((prev) => ({ ...prev, [MY_POS]: { ...prev[MY_POS], username: updatedProfile.username, avatar_url: updatedProfile.avatar_url } }))
    }
  }

  function showEmote(pos, emoji) {
    setEmotes((prev) => ({ ...prev, [pos]: emoji }))
    setTimeout(() => setEmotes((prev) => ({ ...prev, [pos]: null })), 1400)
  }

  function sendEmote(emoji) {
    showEmote(MY_POS, emoji)
    gameChannelRef.current?.send('EMOTE', { pos: MY_POS, emoji })
  }

  function sendChat(text) {
    const author = livePlayers[MY_POS]?.username ?? 'You'
    setChatMessages((prev) => [...prev, { author, text }])
    gameChannelRef.current?.send('CHAT', { author, text })
  }

  // Leaving mid-game keeps the player's seat (see markPlayerLeft) so they
  // can rejoin later instead of losing their hand/turn — only a genuinely
  // finished match (game_over) has nothing left to reconnect to, so that
  // case tells the caller to drop the "rejoin" pointer entirely.
  function handleExit() {
    if (isMultiplayer && myUserId && room?.id && phase !== 'game_over') {
      markPlayerLeft(room.id, myUserId).catch(() => {})
    }
    onExit?.(phase === 'game_over')
  }

  const trickCardPositions = {
    bottom: 'bottom-[26%] left-1/2 -translate-x-1/2',
    top: 'top-[26%] left-1/2 -translate-x-1/2',
    left: 'left-[26%] top-1/2 -translate-y-1/2',
    right: 'right-[26%] top-1/2 -translate-y-1/2',
  }

  // Both partners already carry the same shared total under team-combined
  // scoring (see scoreTeam in lib/cards.js) — summing them would double the
  // displayed score instead of showing the team's real combined total.
  const teamAScore = runningScores.bottom.total
  const teamBScore = runningScores.left.total

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative gap-2 p-2 sm:p-3 bg-gradient-to-b from-[#0B0C10] via-[#1F2833] to-[#0B0C10]">
      {errorToast && (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-[200] max-w-[90%] rounded-xl px-4 py-2.5 text-xs font-semibold text-white text-center shadow-lg"
          style={{ background: '#dc2626', animation: 'fadeUp 0.25s ease both' }}
        >
          {errorToast}
        </div>
      )}

      {boardNotice && (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-[200] max-w-[90%] rounded-xl px-4 py-2.5 text-xs font-semibold text-center shadow-lg bg-slate-900/90 backdrop-blur-md border"
          style={{ borderColor: '#fbbf2488', color: '#fde68a', animation: 'fadeUp 0.25s ease both' }}
        >
          {boardNotice}
        </div>
      )}

      {totalBidNotice && (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-[200] max-w-[90%] rounded-xl px-4 py-2.5 text-xs font-semibold text-center shadow-lg bg-slate-900/90 backdrop-blur-md border"
          style={{ borderColor: '#a78bfa88', color: '#e9d5ff', animation: 'fadeUp 0.25s ease both' }}
        >
          {totalBidNotice}
        </div>
      )}

      {newAchievements.length > 0 && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-1.5 items-center">
          {newAchievements.map((a, i) => {
            const tier = TIER_STYLE[a.tier]
            return (
              <div
                key={`${a.id}-${i}`}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-center shadow-lg bg-slate-900/90 backdrop-blur-md border"
                style={{ borderColor: `${(tier?.ring ?? a.color)}88`, animation: 'fadeUp 0.25s ease both' }}
              >
                <span className="text-base">{a.icon}</span>
                <span style={{ color: a.color }}>Achievement Unlocked: {a.title}</span>
                {tier && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${tier.ring}33`, color: tier.ring }}>
                    {tier.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rankUp && (
        <div className="absolute inset-0 z-[210] flex items-center justify-center pointer-events-none px-6">
          <div
            className="flex flex-col items-center gap-2 rounded-2xl px-8 py-6 text-center shadow-2xl bg-slate-900/95 backdrop-blur-md border-2"
            style={{ borderColor: `${rankUp.color}aa`, animation: 'rankPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, pulseGlow 1.8s ease-in-out 0.5s infinite' }}
          >
            <span className="text-5xl" style={{ filter: `drop-shadow(0 0 12px ${rankUp.color}aa)` }}>{rankUp.icon}</span>
            <p className="text-[10px] tracking-widest font-semibold uppercase text-white/50">Rank Up</p>
            <p className="text-2xl font-display font-extrabold" style={{ color: rankUp.color }}>{rankUp.label}</p>
          </div>
        </div>
      )}

      <ScoreBar
        leftLabel="You & Partner"
        rightLabel="Opponents"
        leftScore={myTeam === 'A' ? teamAScore : teamBScore}
        rightScore={myTeam === 'A' ? teamBScore : teamAScore}
        target={winScore}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div
        className="flex-1 relative rounded-[40px] overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.85)]"
        style={{
          background: tableTheme?.tableStyle?.background ?? 'radial-gradient(ellipse at center, #0B1A10 0%, #050705 100%)',
          border: `4px solid ${accentColor}40`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: tableTheme?.centerGlow, opacity: 0.8 }} />

        {POSITIONS.map((pos) => (
          <SeatChip
            key={pos}
            position={toScreenSlot(pos, mySeat)}
            player={livePlayers[pos]}
            bid={bids[pos]}
            tricks={tricks[pos]}
            isActive={phase === 'playing' && turn === pos}
            accentColor={accentColor}
          />
        ))}

        {phase !== 'dealing' && POSITIONS.filter((p) => p !== MY_POS).map((pos) => {
          const slot = toScreenSlot(pos, mySeat)
          const count = hands[pos]?.length ?? 0
          if (slot === 'top') return <FaceDownFan key={pos} count={count} accentColor={accentColor} />
          if (slot === 'left') return <VerticalFan key={pos} count={count} side="left" color={accentColor} />
          if (slot === 'right') return <VerticalFan key={pos} count={count} side="right" color="#38bdf8" />
          return null
        })}

        {currentTrick.map(({ pos, card }) => (
          <div key={card.id ?? `${pos}-${card.suit}-${card.value}`} className={`absolute z-20 ${trickCardPositions[toScreenSlot(pos, mySeat)]}`} style={{ animation: 'fadeUp 0.25s ease both' }}>
            <PlayingCard suit={card.suit} value={card.value} size="sm" accentColor={accentColor} deckTheme={deckTheme} />
          </div>
        ))}

        {trickWinnerFlash && (
          <div className={`absolute z-25 ${trickCardPositions[toScreenSlot(trickWinnerFlash, mySeat)]} text-xs font-bold px-2 py-1 rounded-full`} style={{ background: accentColor, color: '#0a0812', animation: 'fadeUp 0.3s ease both' }}>
            Trick!
          </div>
        )}

        {Object.entries(emotes).map(([pos, emoji]) =>
          emoji ? (
            <div key={pos} className={`absolute z-30 text-2xl ${trickCardPositions[toScreenSlot(pos, mySeat)]}`} style={{ animation: 'floatUpFade 1.4s ease both' }}>
              {emoji}
            </div>
          ) : null
        )}

        {phase === 'dealing' && <DealingAnimationV2 key={dealNonce} onComplete={handleDealComplete} accentColor={accentColor} />}

        {awaitingBlindDecision && (
          <BlindNilPrompt accentColor={accentColor} onGoBlind={chooseBlindNil} onReveal={revealHand} />
        )}

        {phase === 'bidding' && bids[MY_POS] === null && myRevealed && (
          <BidPanel
            accentColor={accentColor}
            onConfirm={(n) => {
              persist({ bids: { [MY_POS]: n } })
              setBids((prev) => ({ ...prev, [MY_POS]: n }))
              playBid()
            }}
          />
        )}
      </div>

      <div className="shrink-0 z-40">
        {phase === 'bidding' && bids[MY_POS] !== null && (
          <div
            className="mx-2 mb-3 rounded-xl px-4 py-3 text-center text-sm bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl"
          >
            Bid submitted: {bids[MY_POS] === 0 ? (blindNil[MY_POS] ? 'Blind Nil (2x)' : 'Nil') : bids[MY_POS]} — waiting for other players to bid…
          </div>
        )}

        {phase === 'playing' && (
          <div className="flex items-center justify-between mx-2 mb-2 px-4 py-2 text-xs text-white/60 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10">
            <button onClick={handleExit} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-xs font-semibold">
              Leave Match
            </button>
            <span>
              Bid {bids[MY_POS] === 0 ? (blindNil[MY_POS] ? 'Blind Nil' : 'Nil') : bids[MY_POS]} · Tricks {tricks[MY_POS]} · Score {runningScores[MY_POS].total}
            </span>
            <div className="flex items-center gap-2">
              <EmojiReactions onReact={sendEmote} />
              <GameChat messages={chatMessages} onSend={sendChat} accentColor={accentColor} />
            </div>
          </div>
        )}

        <PlayerHand
          cards={hands[MY_POS] ?? []}
          selectedCard={selectedCard}
          isMyTurn={isMyTurn}
          currentTrick={currentTrick}
          spadesBroken={spadesBroken}
          useJD={useJD}
          spadesBreakRule={spadesBreakRule}
          onCardClick={handleMyCardClick}
          accentColor={accentColor}
          deckTheme={deckTheme}
          masked={awaitingBlindDecision}
        />
      </div>

      {phase === 'result' && roundDetail && (
        <RoundOverModal
          roundDetail={roundDetail}
          runningScores={runningScores}
          getSeatLabel={getSeatLabel}
          isHost={isHost}
          onNextRound={startDeal}
          onQuit={handleExit}
          accentColor={accentColor}
          chatMessages={chatMessages}
          onSendChat={sendChat}
        />
      )}

      {phase === 'game_over' && matchWinner && (
        <MatchWinnerModal
          winnerLabel={matchWinner}
          finalScores={runningScores}
          onQuit={handleExit}
          accentColor={accentColor}
          chatMessages={chatMessages}
          onSendChat={sendChat}
        />
      )}

      {leftPlayerPos && (
        <PlayerLeftModal
          playerName={getSeatLabel(leftPlayerPos)}
          isHost={isHost}
          onReplaceBot={handleReplaceBot}
          onLeave={handleExit}
          accentColor={accentColor}
        />
      )}

      {settingsOpen && (
        <GameSettingsSheet
          deckTheme={deckTheme}
          tableTheme={tableTheme}
          muted={muted}
          onToggleMute={toggleMute}
          onChangeDeck={() => {
            setSettingsOpen(false)
            setDeckPickerOpen(true)
          }}
          onChangeTable={() => {
            setSettingsOpen(false)
            setTablePickerOpen(true)
          }}
          onEditProfile={
            authUser
              ? () => {
                  setSettingsOpen(false)
                  setProfilePickerOpen(true)
                }
              : undefined
          }
          onLeave={handleExit}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {profilePickerOpen && authUser && (
        <ProfileModal
          user={authUser}
          profile={profile}
          onClose={() => setProfilePickerOpen(false)}
          onProfileUpdate={handleProfileUpdate}
          onSignOut={() => {
            setProfilePickerOpen(false)
            onSignOut?.()
          }}
        />
      )}

      {deckPickerOpen && (
        <DeckThemesModal
          selectedId={deckTheme?.id}
          onSelect={(t) => {
            onChangeDeckTheme?.(t)
            setDeckPickerOpen(false)
          }}
          onClose={() => setDeckPickerOpen(false)}
        />
      )}

      {tablePickerOpen && (
        <TableThemesModal
          selectedId={tableTheme?.id}
          onSelect={(t) => {
            onChangeTableTheme?.(t)
            setTablePickerOpen(false)
          }}
          onClose={() => setTablePickerOpen(false)}
        />
      )}
    </div>
  )
}
