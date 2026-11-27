import { startTransition, Suspense, useCallback, useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import Landing from './components/Landing'
import { lazyLoad, newerVersionLive } from './lib/freshLoad'
const AuthModal = lazyLoad(() => import('./components/AuthModal'))
const NewPasswordModal = lazyLoad(() => import('./components/NewPasswordModal'))
const ChallengesModal = lazyLoad(() => import('./components/ChallengesModal'))
const RulesModal = lazyLoad(() => import('./components/RulesModal'))
const ProfileModal = lazyLoad(() => import('./components/ProfileModal'))
const LeaderboardModal = lazyLoad(() => import('./components/LeaderboardModal'))
const LearnModal = lazyLoad(() => import('./components/LearnModal'))
import Lobby from './components/online/Lobby'
const WaitingRoom = lazyLoad(() => import('./components/online/WaitingRoom'))
const CardGallery = lazyLoad(() => import('./components/CardGallery'))
const showGallery = new URLSearchParams(window.location.search).has('gallery')
const OnlineTable = lazyLoad(() => import('./components/table/Tables').then((m) => ({ default: m.OnlineTable })))
const PracticeTable = lazyLoad(() => import('./components/table/Tables').then((m) => ({ default: m.PracticeTable })))
import { DeckPicker, TablePicker } from './components/ThemePickers'
import InviteBanner from './components/online/InviteBanner'
import { onAuthStateChange, onPasswordRecovery, getSession, signOut, fetchOrCreateProfile } from './lib/auth'
import { openedFromResetLink, supabaseEnabled } from './lib/supabase'
import { fetchRoom, joinTable, leaveTable } from './lib/online'
import { forgetDevice, syncPush } from './lib/push'
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
// A tapped friend-request notification opens /?open=friends.
const openFriendsFromUrl = new URLSearchParams(window.location.search).get('open') === 'friends'
if (openFriendsFromUrl) window.history.replaceState(null, '', window.location.pathname)

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing') // landing | waiting | online | practice
  const [modal, setModal] = useState(openedFromResetLink ? 'newPassword' : joinCodeFromUrl ? 'lobby' : openFriendsFromUrl ? 'friends' : null)
  const [rules, setRules] = useState({ ...DEFAULT_GAME_RULES, ...prefs.gameSettings })
  const [customTables, setCustomTables] = useState(storedCustomTables(prefs))
  const [table, setTable] = useState(() => resolveTable(prefs.tableThemeId, storedCustomTables(prefs)))
  const [deck, setDeck] = useState(() => ALL_DECKS.find((d) => d.id === prefs.deckThemeId) ?? DEFAULT_DECK)
  const [room, setRoom] = useState(null)
  const [rejoinable, setRejoinable] = useState(null)
  const [practice, setPractice] = useState(null) // { key, resume, coached }
  const [savedPractice, setSavedPractice] = useState(() => loadSavedPractice())

  useEffect(() => {
    if (!supabaseEnabled) return
    getSession().then((s) => setUser(s?.user ?? null))
    const { data } = onAuthStateChange((s) => setUser(s?.user ?? null))
    const offRecovery = onPasswordRecovery(() => setModal('newPassword'))
    return () => {
      data?.subscription?.unsubscribe?.()
      offRecovery()
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    fetchOrCreateProfile(user).then(setProfile)
    syncPush()
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

  // An app left open (Mac Dock, phone home screen) keeps running the version it
  // started with. When you come back to it on the home screen, switch to any
  // newer version before a tap needs one of its pieces.
  useEffect(() => {
    if (view !== 'landing') return
    let checkedAt = 0
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - checkedAt < 60_000) return
      checkedAt = Date.now()
      if (await newerVersionLive()) window.location.reload()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
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

  // Join a friend's table by its code (from an invite or the friends list),
  // leaving any waiting room you're already sitting in.
  async function joinByCode(code) {
    const name = profile?.username || user?.email?.split('@')[0] || 'Player'
    if (room && view === 'waiting' && room.code !== code) leaveTable(room.id).catch(() => {})
    const res = await joinTable(code, name)
    setModal(null)
    enterRoom(res.room)
  }

  function startPractice(resume = null, coached = false) {
    if (!resume) clearSavedPractice()
    setPractice({ key: Date.now(), resume, coached: resume ? !!resume.coached : coached })
    setModal(null)
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
    await forgetDevice().catch(() => {})
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
          onLearn={() => setModal('learn')}
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
      {view === 'practice' && practice && <PracticeTable key={practice.key} rules={rules} myName={myName} resume={practice.resume} coached={practice.coached} {...tableProps} />}

      {modal === 'newPassword' && user && <NewPasswordModal onClose={() => setModal(null)} />}
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
      {(modal === 'profile' || modal === 'friends') && user && (
        <ProfileModal user={user} profile={profile} initialTab={modal === 'friends' ? 'Friends' : 'Overview'} onClose={() => setModal(null)} onProfileUpdate={setProfile} onSignOut={handleSignOut} onJoinTable={joinByCode} />
      )}
      {user && view !== 'online' && !showGallery && <InviteBanner user={user} onJoin={joinByCode} />}
      {modal === 'learn' && <LearnModal rules={rules} deck={deck} onClose={() => setModal(null)} onPlayCoached={() => startPractice(null, true)} />}
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
      <DeckPicker open={modal === 'deck'} selectedId={deck.id} onSelect={(d) => { setModal(null); startTransition(() => chooseDeck(d)) }} onClose={() => setModal(null)} />
      <TablePicker open={modal === 'table'} selectedId={table.id} customTables={customThemes} onDeleteCustom={deleteCustomTable} onSelect={(t) => { chooseTable(t); setModal(null) }} onClose={() => setModal(null)} />
      </Suspense>
    </MotionConfig>
  )
}
