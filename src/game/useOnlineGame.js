// Online table state: the server's room row (realtime + a slow safety poll),
// your own hand, and `act` to send a move. Never runs game logic itself —
// the `game` edge function does — so nobody's device is the "host".
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMyHand, fetchRoom, sendMove, subscribeRoom } from '../lib/online'

const POLL_MS = 5000

export function useOnlineGame(initialRoom, userId) {
  const [room, setRoom] = useState(initialRoom)
  const [hand, setHand] = useState({ round: -1, cards: [] })
  const [connection, setConnection] = useState('connecting')
  const versionRef = useRef(initialRoom?.version ?? 0)
  const lastRowAtRef = useRef(Date.now())
  const offsetRef = useRef(0) // server clock − local clock
  const roomId = initialRoom?.id

  const applyRoom = useCallback((row) => {
    if (!row) return
    lastRowAtRef.current = Date.now()
    if ((row.version ?? 0) < versionRef.current) return
    versionRef.current = row.version ?? 0
    if (row.game_state?.at) offsetRef.current = row.game_state.at - Date.now()
    setRoom(row)
  }, [])

  // Realtime row updates.
  useEffect(() => {
    if (!roomId) return
    return subscribeRoom(roomId, applyRoom, (status) => {
      if (status === 'SUBSCRIBED') {
        setConnection('live')
        fetchRoom(roomId).then(applyRoom)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnection('reconnecting')
      }
    })
  }, [roomId, applyRoom])

  // Safety net: if realtime goes quiet, read the row directly. Also catch up
  // immediately when the tab comes back or the network returns.
  useEffect(() => {
    if (!roomId) return
    const refresh = () => fetchRoom(roomId).then(applyRoom)
    const timer = setInterval(() => {
      if (Date.now() - lastRowAtRef.current > POLL_MS) refresh()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [roomId, applyRoom])

  const pub = room?.game_state?.v ? room.game_state : null
  const me = room?.players?.find((p) => p.id === userId) ?? null
  const mySeat = me?.seat ?? 0

  // Your cards: refetch whenever a new round is dealt (or on first load).
  useEffect(() => {
    if (!roomId || !pub || hand.round === pub.round) return
    let cancelled = false
    fetchMyHand(roomId).then((cards) => {
      if (!cancelled && Array.isArray(cards)) setHand({ round: pub.round, cards })
    })
    return () => {
      cancelled = true
    }
  }, [roomId, pub?.round, hand.round]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback(
    async (move) => {
      const res = await sendMove(roomId, move)
      if (res?.now) offsetRef.current = res.now - Date.now()
      if (res?.room) applyRoom(res.room)
      if (Array.isArray(res?.hand) && res.room?.game_state?.round != null) setHand({ round: res.room.game_state.round, cards: res.hand })
      return res
    },
    [roomId, applyRoom]
  )

  // Anyone at the table can poke a stalled turn once its deadline has passed
  // on the server's clock; the server decides whether it really has.
  const nudgedRef = useRef(0)
  useEffect(() => {
    if (!pub?.deadline || room?.status !== 'playing') return
    const t = setInterval(() => {
      const serverNow = Date.now() + offsetRef.current
      if (serverNow > pub.deadline + 1500 && nudgedRef.current !== pub.seq) {
        nudgedRef.current = pub.seq
        sendMove(roomId, { type: 'nudge' })
          .then((res) => res?.room && applyRoom(res.room))
          .catch(() => {
            nudgedRef.current = 0
          })
      }
    }, 1000)
    return () => clearInterval(t)
  }, [pub?.deadline, pub?.seq, room?.status, roomId, applyRoom])

  const serverNow = useCallback(() => Date.now() + offsetRef.current, [])

  return { room, pub, players: room?.players ?? [], mySeat, me, hand, act, connection, serverNow }
}
