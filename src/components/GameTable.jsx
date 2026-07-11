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
import { updateRoom, mergeGameState, subscribeToRoom, leaveRoom, replacePlayerWithBot, openGameChannel, updatePlayerInfo } from '../lib/rooms'
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
import { checkAndUnlockAchievements } from '../lib/social'

const NEXT_TURN = { bottom: 'left', left: 'top', top: 'right', right: 'bottom' }

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
  const matchRecordedRef = useRef(false)
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

  const playShuffle = useSound('shuffle')
  const playBid = useSound('bid')
  const playCardSfx = useSound('cardPlay')
  const playTrickWin = useSound('trickWin')
  const playFanfare = useSound('fanfare')
  const playError = useSound('error')

  const pendingTrickRef = useRef(false)
  // Guards against a rapid double-tap/double-click playing two cards for the
  // same turn: playCard reads currentTrick/ledSuit/spadesBroken from the
  // render closure rather than a functional update, so two calls firing
  // before React re-renders between them would both see the same stale
  // currentTrick and could both append to it — corrupting the trick (e.g. a
  // duplicate seat entry) in a way evaluateTrick can't cleanly resolve,
  // stalling the game. Cleared once `turn` actually changes.
  const playingCardRef = useRef(false)
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

  function persist(patch) {
    const dbPatchState = patch.phase ? { ...patch, phase: LOCAL_TO_DB_PHASE[patch.phase] ?? patch.phase } : patch
    gameStateRef.current = { ...gameStateRef.current, ...dbPatchState }
    if (isMultiplayer && roomIdRef.current) {
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

  const startDeal = useCallback(() => {
    playShuffle()
    const nextHands = dealHands(useJD)
    setHands(nextHands)
    setBids(blankBids())
    setTricks(blankTricks())
    setCurrentTrick([])
    setTurn('bottom')
    setLedSuit(null)
    setSpadesBroken(false)
    setSelectedCard(null)
    setRoundDetail(null)
    setPhase('dealing')
    setDealNonce((n) => n + 1)
    setBlindNil(blankBlind())
    setRevealed({})
    if (!isMultiplayer || isHost) {
      persist({
        hands: nextHands,
        bids: blankBids(),
        tricks: blankTricks(),
        current_trick: [],
        current_turn: 'bottom',
        led_suit: null,
        spades_broken: false,
        round_detail: null,
        blind_nil: blankBlind(),
        phase: 'dealing',
        round: (gameStateRef.current.round ?? 0) + 1,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useJD, isMultiplayer, isHost])

  useEffect(() => {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hydrate(gs) {
    gameStateRef.current = gs
    if (gs.hands) setHands(gs.hands)
    if (gs.bids) setBids(gs.bids)
    if (gs.tricks) setTricks(gs.tricks)
    setCurrentTrick(gs.current_trick ?? [])
    setTurn(gs.current_turn ?? 'bottom')
    setLedSuit(gs.led_suit ?? null)
    setSpadesBroken(!!gs.spades_broken)
    if (gs.blind_nil) setBlindNil(gs.blind_nil)
    setRoundDetail(gs.round_detail ?? null)
    if (gs.running_scores) setRunningScores(gs.running_scores)
    if (gs.phase) setPhase(DB_TO_LOCAL_PHASE[gs.phase] ?? gs.phase)
    if (typeof gs.round === 'number') setDealNonce(gs.round)
  }

  // Multiplayer: mirror remote room state.
  useEffect(() => {
    if (!isMultiplayer || !room?.id) return
    const sub = subscribeToRoom(room.id, (updatedRoom) => {
      if (updatedRoom.game_state) hydrate(updatedRoom.game_state)
      if (updatedRoom.players) {
        const newIds = {}
        updatedRoom.players.forEach((p) => {
          newIds[seatToDataPos(p.seat)] = p.id
        })
        const prevIds = knownPlayerIdsRef.current
        if (prevIds) {
          for (const pos of POSITIONS) {
            const wasHuman = prevIds[pos] && !livePlayersRef.current[pos]?.isBot
            if (wasHuman && !newIds[pos]) {
              setLeftPlayerPos((cur) => cur ?? pos)
            }
          }
        }
        knownPlayerIdsRef.current = newIds
        setLivePlayers((prev) => {
          const next = { ...prev }
          updatedRoom.players.forEach((p) => {
            const pos = seatToDataPos(p.seat)
            next[pos] = { ...next[pos], username: p.name, isBot: !!p.isBot }
          })
          return next
        })
      }
    })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, room?.id])

  // Auto-dismiss the "player left" prompt once that seat has been replaced with a bot.
  useEffect(() => {
    if (leftPlayerPos && livePlayers[leftPlayerPos]?.isBot) {
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
            // The table can never take more than 13 tricks combined, so cap
            // this bot's bid to whatever's left once every other seat's
            // already-submitted bid (bot or human) is subtracted.
            const alreadyBid = POSITIONS.reduce((sum, p) => sum + (p === pos ? 0 : prev[p] ?? 0), 0)
            const remainingBudget = Math.max(0, 13 - alreadyBid)
            const bid = estimateBotBid(hands[pos] ?? [], nilEnabled, useJD, remainingBudget)
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
      if (short) {
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
      setTricks((prev) => {
        const next = { ...prev, [winnerPos]: prev[winnerPos] + 1 }
        persist({ tricks: next, current_trick: [], led_suit: null, current_turn: winnerPos })
        return next
      })
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
  useEffect(() => {
    if (phase !== 'playing') return
    if (isMultiplayer && !isHost) return
    const total = POSITIONS.reduce((sum, p) => sum + tricks[p], 0)
    if (total !== 13) return
    if (currentTrick.length !== 0) return
    const detail = scoreRound(bids, tricks, bags, settings, blindNil)
    setRoundDetail(detail)
    setBags((prev) => {
      const next = { ...prev }
      POSITIONS.forEach((p) => {
        next[p] = detail[p].bags
      })
      return next
    })
    let nextRunning
    setRunningScores((prev) => {
      nextRunning = { ...prev }
      POSITIONS.forEach((p) => {
        nextRunning[p] = { total: prev[p].total + detail[p].score, bags: detail[p].bags }
      })
      return nextRunning
    })
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

  useEffect(() => {
    if (phase !== 'result' || !runningScores) return
    if (isMultiplayer && !isHost) return
    const partnership = settings.partnershipMode !== false
    if (partnership) {
      const teamA = runningScores.bottom.total + runningScores.top.total
      const teamB = runningScores.left.total + runningScores.right.total
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
      const teamA = runningScores.bottom.total + runningScores.top.total
      const teamB = runningScores.left.total + runningScores.right.total
      yourScore = myTeam === 'A' ? teamA : teamB
      opponentScore = myTeam === 'A' ? teamB : teamA
    } else {
      yourScore = runningScores[MY_POS]?.total ?? 0
      opponentScore = Math.max(0, ...POSITIONS.filter((p) => p !== MY_POS).map((p) => runningScores[p]?.total ?? 0))
    }
    won = yourScore > opponentScore
    recordMatchResult(myUserId, { won, yourScore, opponentScore, rounds: dealNonce }).then((updatedProfile) => {
      if (!updatedProfile) return
      checkAndUnlockAchievements(myUserId, {
        won,
        marginOfVictory: yourScore - opponentScore,
        moonShot: wasMoonShot,
        profile: updatedProfile,
      }).then((newly) => {
        if (newly.length) setNewAchievements(newly)
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

  function handleExit() {
    if (isMultiplayer && myUserId && room?.id) {
      leaveRoom(room.id, myUserId).catch(() => {})
    }
    onExit?.()
  }

  const trickCardPositions = {
    bottom: 'bottom-[26%] left-1/2 -translate-x-1/2',
    top: 'top-[26%] left-1/2 -translate-x-1/2',
    left: 'left-[26%] top-1/2 -translate-y-1/2',
    right: 'right-[26%] top-1/2 -translate-y-1/2',
  }

  const teamAScore = runningScores.bottom.total + runningScores.top.total
  const teamBScore = runningScores.left.total + runningScores.right.total

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

      {newAchievements.length > 0 && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-1.5 items-center">
          {newAchievements.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-center shadow-lg bg-slate-900/90 backdrop-blur-md border"
              style={{ borderColor: `${a.color}88`, animation: 'fadeUp 0.25s ease both' }}
            >
              <span className="text-base">{a.icon}</span>
              <span style={{ color: a.color }}>Achievement Unlocked: {a.title}</span>
            </div>
          ))}
        </div>
      )}

      <ScoreBar
        leftLabel="You & Partner"
        rightLabel="Opponents"
        leftScore={teamAScore}
        rightScore={teamBScore}
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
            maxBid={Math.max(0, 13 - POSITIONS.reduce((sum, p) => sum + (p === MY_POS ? 0 : bids[p] ?? 0), 0))}
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
