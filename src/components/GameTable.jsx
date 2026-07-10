import { useCallback, useEffect, useRef, useState } from 'react'
import {
  POSITIONS,
  dealHands,
  evaluateTrick,
  scoreRound,
  estimateBotBid,
  botCardChoice,
} from '../lib/cards'
import { updateRoom, mergeGameState, subscribeToRoom, leaveRoom } from '../lib/rooms'
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
import EmojiReactions from './EmojiReactions'
import GameChat from './GameChat'
import { useSound, setSoundMuted, isSoundMuted } from '../hooks/useSound'

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
  room,
  myUserId,
  mySeat = 0,
  onExit,
}) {
  const accentColor = tableTheme?.accentColor ?? '#a78bfa'
  const winScore = settings.winScore ?? 500
  const useJD = !!settings.jokersWild
  const isMultiplayer = mode === 'multiplayer' && !!room
  const isHost = !isMultiplayer || room.host_id === myUserId
  const MY_POS = seatToDataPos(mySeat)

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
  const [trickWinnerFlash, setTrickWinnerFlash] = useState(null)
  const [emotes, setEmotes] = useState({})
  const [chatMessages, setChatMessages] = useState([])
  const [dealNonce, setDealNonce] = useState(0)
  const [muted, setMuted] = useState(isSoundMuted())

  const playShuffle = useSound('shuffle')
  const playBid = useSound('bid')
  const playCardSfx = useSound('cardPlay')
  const playTrickWin = useSound('trickWin')
  const playFanfare = useSound('fanfare')

  const pendingTrickRef = useRef(false)
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
      writeQueueRef.current = writeQueueRef.current.then(() => mergeGameState(roomIdRef.current, dbPatchState).catch(() => {}))
    }
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
    })
    return () => sub.unsubscribe()
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
      const player = players[pos]
      if (player?.isBot && bids[pos] === null) {
        const t = setTimeout(() => {
          setBids((prev) => {
            if (prev[pos] !== null) return prev
            const bid = estimateBotBid(hands[pos] ?? [], nilEnabled)
            persist({ bids: { [pos]: bid } })
            playBid()
            return { ...prev, [pos]: bid }
          })
        }, 400 + Math.random() * 900)
        timers.push(t)
      }
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hands, players, settings.standardNil, isMultiplayer, isHost])

  // Transition bidding -> playing once all bids in (host-only in multiplayer).
  useEffect(() => {
    if (phase !== 'bidding') return
    if (isMultiplayer && !isHost) return
    if (POSITIONS.every((p) => bids[p] !== null)) {
      const t = setTimeout(() => {
        setPhase('playing')
        persist({ phase: 'playing' })
      }, 500)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bids, isMultiplayer, isHost])

  const isMyTurn = phase === 'playing' && turn === MY_POS

  function playCard(pos, card) {
    playCardSfx()
    setHands((prev) => {
      const nextHands = { ...prev, [pos]: prev[pos].filter((c) => c.id !== card.id) }
      let nextLedSuit = ledSuit
      const nextTrick = [...currentTrick, { pos, card }]
      if (nextTrick.length === 1) nextLedSuit = card.suit === 'JOKER' ? 'S' : card.suit
      const nextSpadesBroken = spadesBroken || card.suit === 'S'
      const nextTurn = NEXT_TURN[pos]
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
      return nextHands
    })
    setSelectedCard(null)
  }

  function handleMyCardClick(card) {
    if (!isMyTurn) return
    playCard(MY_POS, card)
  }

  // Bot card play — host authoritative in multiplayer.
  useEffect(() => {
    if (phase !== 'playing') return
    if (isMultiplayer && !isHost) return
    const player = players[turn]
    if (!player?.isBot) return
    if (currentTrick.length === 4) return
    const t = setTimeout(() => {
      const hand = hands[turn] ?? []
      if (!hand.length) return
      const card = botCardChoice(hand, currentTrick, spadesBroken, ledSuit, useJD)
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
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTrick, useJD, isMultiplayer, isHost])

  // Round complete after 13 tricks — host authoritative in multiplayer.
  useEffect(() => {
    if (phase !== 'playing') return
    if (isMultiplayer && !isHost) return
    const total = POSITIONS.reduce((sum, p) => sum + tricks[p], 0)
    if (total !== 13) return
    if (currentTrick.length !== 0) return
    const detail = scoreRound(bids, tricks, bags, settings)
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
    setPhase('result')
    persist({
      phase: 'result',
      round_detail: detail,
      round_scores: POSITIONS.reduce((acc, p) => ({ ...acc, [p]: detail[p].score }), {}),
      running_scores: nextRunning,
    })
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
        setMatchWinner(teamA >= winScore ? 'You & Partner' : 'Opponents')
        setPhase('game_over')
        persist({ phase: 'game_over' })
        playFanfare()
      }
    } else {
      const winnerPos = POSITIONS.find((p) => runningScores[p].total >= winScore)
      if (winnerPos) {
        setMatchWinner(players[winnerPos]?.username ?? winnerPos)
        setPhase('game_over')
        persist({ phase: 'game_over' })
        playFanfare()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isMultiplayer, isHost])

  function getSeatLabel(pos) {
    return players[pos]?.username ?? pos
  }

  function fireEmote(pos, emoji) {
    setEmotes((prev) => ({ ...prev, [pos]: emoji }))
    setTimeout(() => setEmotes((prev) => ({ ...prev, [pos]: null })), 1400)
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
    <div className="flex flex-col h-full w-full overflow-hidden relative" style={{ background: '#0a0812' }}>
      <ScoreBar
        leftLabel="You & Partner"
        rightLabel="Opponents"
        leftScore={teamAScore}
        rightScore={teamBScore}
        target={winScore}
        muted={muted}
        onToggleMute={() => {
          setMuted((m) => {
            setSoundMuted(!m)
            return !m
          })
        }}
      />

      <div
        className="flex-1 relative mx-3 mb-3 rounded-2xl overflow-hidden"
        style={{ ...(tableTheme?.tableStyle ?? {}), }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: tableTheme?.centerGlow, opacity: 0.8 }} />

        {POSITIONS.map((pos) => (
          <SeatChip
            key={pos}
            position={toScreenSlot(pos, mySeat)}
            player={players[pos]}
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

        {phase === 'bidding' && bids[MY_POS] === null && (
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
          <div className="mx-4 mb-3 rounded-xl px-4 py-3 text-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
            Bid submitted: {bids[MY_POS] === 0 ? 'Nil' : bids[MY_POS]} — waiting for other players to bid…
          </div>
        )}

        {phase === 'playing' && (
          <div className="flex items-center justify-between px-4 pb-2 text-xs text-white/50">
            <button onClick={handleExit} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-xs font-semibold">
              Leave Match
            </button>
            <span>
              Bid {bids[MY_POS] === 0 ? 'Nil' : bids[MY_POS]} · Tricks {tricks[MY_POS]} · Score {runningScores[MY_POS].total}
            </span>
            <div className="flex items-center gap-2">
              <EmojiReactions onReact={(e) => fireEmote(MY_POS, e)} />
              <GameChat messages={chatMessages} onSend={(text) => setChatMessages((prev) => [...prev, { author: 'You', text }])} accentColor={accentColor} />
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
          onCardClick={handleMyCardClick}
          accentColor={accentColor}
          deckTheme={deckTheme}
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
        />
      )}

      {phase === 'game_over' && matchWinner && (
        <MatchWinnerModal winnerLabel={matchWinner} finalScores={runningScores} onQuit={handleExit} accentColor={accentColor} />
      )}
    </div>
  )
}
