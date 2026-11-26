// Turns the server's numbered events into paced, animatable steps.
//
// The match state can jump several moves at once (three bots playing in a
// row, a trick being taken, a round ending). Instead of snapping, this plays
// the new events one at a time through the engine's `applyEvent`, waiting
// between them so cards can fly, then lands exactly on the server snapshot.
// If we fall too far behind (a reconnect, a sleeping tab) it just snaps.
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEvent } from '../lib/engine'

const MAX_QUEUE = 40

function snapshotOf(pub) {
  return pub ? JSON.parse(JSON.stringify({ ...pub, events: undefined })) : null
}

export function durationFor(ev, mySeat, fast) {
  const k = fast ? 0.55 : 1
  switch (ev.t) {
    case 'deal':
      return 2100 * (fast ? 0.7 : 1)
    case 'bid':
      return (ev.seat === mySeat ? 250 : 650) * k
    case 'play':
      return (ev.seat === mySeat ? 380 : 620) * k
    case 'trick':
      return 1300 * k
    case 'round':
      return 450
    case 'game':
      return 300
    default:
      return 0
  }
}

// When a table opens on a freshly dealt round, start just before that deal
// so the opening deal (and any bids already made) animate instead of
// appearing all at once. Mid-round joins just show the table as it is.
function initialState(pub) {
  const snap = snapshotOf(pub)
  const events = pub?.events ?? []
  const dealIdx = events.findLastIndex?.((e) => e.t === 'deal') ?? -1
  if (!snap || dealIdx < 0) return { view: snap, queue: [] }
  const since = events.slice(dealIdx)
  const fresh = since.length <= 6 && since.every((e) => e.t === 'deal' || e.t === 'bid')
  if (!fresh) return { view: snap, queue: [] }
  return { view: { ...snap, seq: since[0].seq - 1, phase: 'waiting', counts: [0, 0, 0, 0], trick: [] }, queue: since }
}

export function useEventPlayer(pub, { mySeat, onEvent }) {
  const [init] = useState(() => initialState(pub))
  const [state, setState] = useState(() => ({ view: init.view, event: null }))
  const viewRef = useRef(state.view)
  const queueRef = useRef(init.queue)
  const busyRef = useRef(false)
  const timerRef = useRef(null)
  const latestRef = useRef(pub)
  const skipRef = useRef([]) // optimistic local plays already shown
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const set = useCallback((view, event) => {
    viewRef.current = view
    setState({ view, event })
  }, [])

  const pump = useCallback(() => {
    if (busyRef.current) return
    const ev = queueRef.current.shift()
    if (!ev) {
      // Caught up: settle exactly on the authoritative snapshot.
      const snap = snapshotOf(latestRef.current)
      if (snap) set(snap, null)
      return
    }
    const skipIdx = skipRef.current.findIndex((s) => ev.t === 'play' && s.seat === ev.seat && s.cardId === ev.card?.id)
    if (skipIdx >= 0) {
      // Already on screen from playOptimistic — just adopt the server's numbering.
      skipRef.current.splice(skipIdx, 1)
      viewRef.current = { ...viewRef.current, seq: ev.seq }
      pump()
      return
    }
    const next = applyEvent(viewRef.current, ev)
    set(next, ev)
    onEventRef.current?.(ev, next)
    const ms = durationFor(ev, mySeat, queueRef.current.length > 6)
    if (ms <= 0) {
      pump()
      return
    }
    busyRef.current = true
    timerRef.current = setTimeout(() => {
      busyRef.current = false
      pump()
    }, ms)
  }, [mySeat, set])

  const resync = useCallback(() => {
    clearTimeout(timerRef.current)
    busyRef.current = false
    queueRef.current = []
    skipRef.current = []
    set(snapshotOf(latestRef.current), null)
  }, [set])

  useEffect(() => {
    latestRef.current = pub
    if (!pub) return
    const current = viewRef.current
    const lastSeq = Math.max(current?.seq ?? 0, queueRef.current.at(-1)?.seq ?? 0)
    if (pub.seq === lastSeq && queueRef.current.length) return
    if (!current || pub.seq < (current.seq ?? 0)) {
      resync()
      return
    }
    if (pub.seq === lastSeq) {
      // Same moves, other fields changed (deadline, ready flags): refresh when idle.
      if (!busyRef.current && !queueRef.current.length) set(snapshotOf(pub), null)
      return
    }
    const fresh = (pub.events ?? []).filter((e) => e.seq > lastSeq)
    const contiguous = fresh.length && fresh[0].seq === lastSeq + 1
    if (!contiguous || fresh.length + queueRef.current.length > MAX_QUEUE) {
      resync()
      return
    }
    queueRef.current.push(...fresh)
    pump()
  }, [pub, pump, resync, set])

  useEffect(() => {
    if (queueRef.current.length) pump()
    return () => {
      // Unmount (or a dev-mode remount): stop the timer AND release the
      // busy flag, or a remount would find the queue locked forever.
      clearTimeout(timerRef.current)
      busyRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show your own card leaving your hand immediately, before the server
  // answers; the matching server event is then skipped instead of replayed.
  const playOptimistic = useCallback(
    (seat, card) => {
      const ev = { t: 'play', seat, card, seq: (viewRef.current?.seq ?? 0) + 0.5, local: true }
      skipRef.current.push({ seat, cardId: card.id })
      const next = applyEvent(viewRef.current, ev)
      next.seq = viewRef.current.seq // keep server numbering intact
      set(next, ev)
      onEventRef.current?.(ev, next)
    },
    [set]
  )

  return { view: state.view, event: state.event, playOptimistic, resync }
}
