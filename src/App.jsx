import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import Landing from './components/Landing'
const AuthModal = lazy(() => import('./components/AuthModal'))
const ChallengesModal = lazy(() => import('./components/ChallengesModal'))
const RulesModal = lazy(() => import('./components/RulesModal'))
const ProfileModal = lazy(() => import('./components/ProfileModal'))
const LeaderboardModal = lazy(() => import('./components/LeaderboardModal'))
import Lobby from './components/online/Lobby'
const WaitingRoom = lazy(() => import('./components/online/WaitingRoom'))
const CardGallery = lazy(() => import('./components/CardGallery'))
const showGallery = new URLSearchParams(window.location.search).has('gallery')
const OnlineTable = lazy(() => import('./components/table/Tables').then((m) => ({ default: m.OnlineTable })))
const PracticeTable = lazy(() => import('./components/table/Tables').then((m) => ({ default: m.PracticeTable })))
import { DeckPicker, TablePicker } from './components/ThemePickers'
import { onAuthStateChange, getSession, signOut, fetchOrCreateProfile } from './lib/auth'
import { supabaseEnabled } from './lib/supabase'
import { fetchRoom, joinTable } from './lib/online'
import { clearSavedPractice, loadSavedPractice } from './game/useLocalGame'
import { ALL_DECKS, ALL_TABLES, DEFAULT_DECK, TABLE_THEMES, customTableTheme, MAX_CUSTOM_TABLES } from './data/tableThemes'
import { DEFAULT_GAME_RULES } from './data/challenges'

const PREFS_KEY = 'amaterasuu-noir-spades:preferences'
const ACTIVE_ROOM_KEY = 'amaterasuu-noir-spades:activeRoomPointer'

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable — choices still apply for this session
  }
}

const prefs = readJSON(PREFS_KEY, {})
const savePrefs = (patch) => writeJSON(PREFS_KEY, { ...readJSON(PREFS_KEY, {}), ...patch })

function storedCustomTables(p) {
  if (p.customTables) return p.customTables
  if (p.customTableImage) return [{ id: 'custom', imageDataUrl: p.customTableImage, name: 'Your Custom Table' }]
  return []
}

function resolveTable(id, customs) {
  const c = customs.find((t) => t.id === id)
  if (c) return customTableTheme(c.imageDataUrl, c.id, c.name)
  return ALL_TABLES.find((t) => t.id === id) ?? TABLE_THEMES[0]
}

const joinCodeFromUrl = (() => {
  const m = new URLSearchParams(window.location.search).get('join')
  return m && /^\d{4}$/.test(m) ? m : ''
})()

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing') // landing | waiting | online | practice
  const [modal, setModal] = useState(joinCodeFromUrl ? 'lobby' : null)
  const [rules, setRules] = useState({ ...DEFAULT_GAME_RULES, ...prefs.gameSettings })
  const [customTables, setCustomTables] = useState(storedCustomTables(prefs))
  const [table, setTable] = useState(() => resolveTable(prefs.tableThemeId, storedCustomTables(prefs)))
  const [deck, setDeck] = useState(() => ALL_DECKS.find((d) => d.id === prefs.deckThemeId) ?? DEFAULT_DECK)
  const [room, setRoom] = useState(null)
  const [rejoinable, setRejoinable] = useState(null)
  const [practice, setPractice] = useState(null) // { key, resume }
  const [savedPractice, setSavedPractice] = useState(() => loadSavedPractice())

  useEffect(() => {
    if (!supabaseEnabled) return
    getSession().then((s) => setUser(s?.user ?? null))
    const { data } = onAuthStateChange((s) => setUser(s?.user ?? null))
    return () => data?.subscription?.unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    fetchOrCreateProfile(user).then(setProfile)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A table you were seated at (tab closed, phone died, left mid-match)?
  useEffect(() => {
    if (!user?.id || !supabaseEnabled || view !== 'landing') return
    const pointer = readJSON(ACTIVE_ROOM_KEY, null)
    if (!pointer?.id) return
    fetchRoom(pointer.id).then((r) => {
      const mine = r?.players?.some((p) => p.id === user.id)
      if (r && mine && r.status === 'playing' && r.game_state?.phase !== 'game_over') setRejoinable(r)
      else if (r && mine && r.status === 'waiting') setRejoinable(r)
      else writeJSON(ACTIVE_ROOM_KEY, null)
    })
  }, [user?.id, view])

  useEffect(() => {
    if (view === 'landing') setSavedPractice(loadSavedPractice())
  }, [view])

  const enterRoom = useCallback((r) => {
    writeJSON(ACTIVE_ROOM_KEY, { id: r.id, code: r.code })
    setRoom(r)
    setRejoinable(null)
    setModal(null)
    if (joinCodeFromUrl) window.history.replaceState(null, '', window.location.pathname)
    setView(r.status === 'playing' ? 'online' : 'waiting')
  }, [])

  const exitToLanding = useCallback((finished = true) => {
    if (finished) writeJSON(ACTIVE_ROOM_KEY, null)
    setRoom(null)
    setPractice(null)
    setView('landing')
  }, [])

  async function rejoin() {
    if (!rejoinable) return
    try {
      const name = profile?.username || user?.email?.split('@')[0] || 'Player'
      const res = await joinTable(rejoinable.code, name)
      enterRoom(res.room)
    } catch {
      writeJSON(ACTIVE_ROOM_KEY, null)
      setRejoinable(null)
    }
  }

  function startPractice(resume = null) {
    if (!resume) clearSavedPractice()
    setPractice({ key: Date.now(), resume })
    setView('practice')
  }

  function chooseTable(t) {
    setTable(t)
    if (t.custom && !customTables.some((c) => c.id === t.id)) {
      const next = [...customTables, { id: t.id, imageDataUrl: t.imageDataUrl, name: t.name }].slice(-MAX_CUSTOM_TABLES)
      setCustomTables(next)
      savePrefs({ tableThemeId: t.id, customTables: next })
    } else savePrefs({ tableThemeId: t.id })
  }

  function deleteCustomTable(id) {
    const next = customTables.filter((t) => t.id !== id)
    setCustomTables(next)
    savePrefs({ customTables: next })
    if (table.id === id) chooseTable(TABLE_THEMES[0])
  }

  function chooseDeck(d) {
    setDeck(d)
    savePrefs({ deckThemeId: d.id })
  }

  async function handleSignOut() {
    await signOut()
    setUser(null)
    setModal(null)
    exitToLanding(true)
  }

  const myName = profile?.username || user?.email?.split('@')[0] || 'You'
  const customThemes = customTables.map((t) => customTableTheme(t.imageDataUrl, t.id, t.name))
  const tableProps = {
    deck,
    table,
    user,
    profile,
    onProfileUpdate: setProfile,
    onSignOut: handleSignOut,
    onChangeDeck: chooseDeck,
    onChangeTable: chooseTable,
    customTables: customThemes,
    onDeleteCustomTable: deleteCustomTable,
    onExit: exitToLanding,
  }

  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<div className="fixed inset-0 lacquer" />}>
      {showGallery && <CardGallery />}
      {view === 'landing' && !showGallery && (
        <Landing
          user={user}
          profile={profile}
          deck={deck}
          onPlayOnline={() => setModal('lobby')}
          onPractice={() => startPractice(null)}
          onOpenAuth={() => setModal('auth')}
          onOpenDecks={() => setModal('deck')}
          onOpenTables={() => setModal('table')}
          onOpenRules={() => setModal('rules')}
          onOpenChallenges={() => setModal('challenges')}
          onOpenProfile={() => setModal(user ? 'profile' : 'auth')}
          onOpenLeaderboard={() => setModal('leaderboard')}
          rejoinableRoom={rejoinable}
          onRejoin={rejoin}
          savedPractice={savedPractice}
          onResumePractice={() => startPractice(savedPractice)}
        />
      )}

      {view === 'waiting' && room && <WaitingRoom room={room} user={user} table={table} onStart={(r) => { setRoom(r); setView('online') }} onLeave={() => exitToLanding(true)} />}
      {view === 'online' && room && <OnlineTable key={room.id} room={room} {...tableProps} />}
      {view === 'practice' && practice && <PracticeTable key={practice.key} rules={rules} myName={myName} resume={practice.resume} {...tableProps} />}

      {modal === 'auth' && <AuthModal onClose={() => setModal(joinCodeFromUrl ? 'lobby' : null)} onAuthed={(u) => { setUser(u); setModal(joinCodeFromUrl ? 'lobby' : null) }} onGuest={() => setModal(null)} />}
      <Lobby
        open={modal === 'lobby'}
        onClose={() => setModal(null)}
        user={user}
        profile={profile}
        rules={rules}
        initialCode={joinCodeFromUrl}
        onEditRules={() => setModal('rules')}
        onRequireAuth={() => setModal('auth')}
        onEnterRoom={enterRoom}
      />
      {modal === 'challenges' && <ChallengesModal user={user} onClose={() => setModal(null)} />}
      {modal === 'profile' && user && <ProfileModal user={user} profile={profile} onClose={() => setModal(null)} onProfileUpdate={setProfile} onSignOut={handleSignOut} />}
      {modal === 'leaderboard' && <LeaderboardModal currentUserId={user?.id} onClose={() => setModal(null)} />}
      {modal === 'rules' && (
        <RulesModal
          initialRules={rules}
          onClose={() => setModal(null)}
          onSave={(r) => {
            setRules(r)
            savePrefs({ gameSettings: r })
            setModal(null)
          }}
        />
      )}
      <DeckPicker open={modal === 'deck'} selectedId={deck.id} onSelect={(d) => { chooseDeck(d); setModal(null) }} onClose={() => setModal(null)} />
      <TablePicker open={modal === 'table'} selectedId={table.id} customTables={customThemes} onDeleteCustom={deleteCustomTable} onSelect={(t) => { chooseTable(t); setModal(null) }} onClose={() => setModal(null)} />
      </Suspense>
    </MotionConfig>
  )
}
