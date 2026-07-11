import { useEffect, useState } from 'react'
import Landing from './components/Landing'
import AuthModal from './components/AuthModal'
import LobbyModal from './components/LobbyModal'
import ChallengesModal from './components/ChallengesModal'
import RulesModal from './components/RulesModal'
import TableThemesModal from './components/TableThemesModal'
import DeckThemesModal from './components/DeckThemesModal'
import ProfileModal from './components/ProfileModal'
import LeaderboardModal from './components/LeaderboardModal'
import GameTable from './components/GameTable'
import RoomWaitingScreen from './components/RoomWaitingScreen'
import { onAuthStateChange, getSession, signOut, fetchOrCreateProfile } from './lib/auth'
import { supabaseEnabled } from './lib/supabase'
import { fromDbSettings } from './lib/rooms'
import { POSITIONS } from './lib/cards'
import { TABLE_THEMES, MASTER_THEMES, DECK_THEMES, MASTER_DECK_THEMES } from './data/tableThemes'
import { DEFAULT_GAME_RULES } from './data/challenges'

const BOT_NAMES = ['Nyx', 'Kestrel', 'Osiris']
const PREFS_KEY = 'amaterasuu-noir-spades:preferences'

function seatToDataPos(seat) {
  return POSITIONS[((seat % 4) + 4) % 4]
}

function buildPlayersMap(players) {
  const map = {}
  for (const p of players) {
    map[seatToDataPos(p.seat)] = { username: p.name, isBot: !!p.isBot, avatar_url: p.avatar_url }
  }
  return map
}

// Rule/theme choices are local device preferences (not tied to the signed-in
// account), so they're persisted to localStorage rather than Supabase —
// without this, "Save Rules" only lived in memory and reset on every reload.
function loadStoredPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePreferences(patch) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadStoredPreferences(), ...patch }))
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) — the
    // choice still applies for this session, it just won't persist.
  }
}

const storedPrefs = loadStoredPreferences()

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('landing') // landing | room-waiting | game
  const [modal, setModal] = useState(null) // auth | lobby | challenges | rules | tableThemes | deckThemes | profile | leaderboard
  const [gameSettings, setGameSettings] = useState({ ...DEFAULT_GAME_RULES, ...storedPrefs.gameSettings })
  const [tableTheme, setTableTheme] = useState(
    [...TABLE_THEMES, ...MASTER_THEMES].find((t) => t.id === storedPrefs.tableThemeId) ?? TABLE_THEMES[0]
  )
  const [deckTheme, setDeckTheme] = useState(
    [...DECK_THEMES, ...MASTER_DECK_THEMES].find((d) => d.id === storedPrefs.deckThemeId) ?? DECK_THEMES[0]
  )
  const [activeRoom, setActiveRoom] = useState(null)

  useEffect(() => {
    if (!supabaseEnabled) return
    getSession().then((session) => setUser(session?.user ?? null))
    const { data } = onAuthStateChange((session) => setUser(session?.user ?? null))
    return () => data?.subscription?.unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    fetchOrCreateProfile(user).then(setProfile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function startQuickGame() {
    setActiveRoom(null)
    setView('game')
  }

  function handleSaveRules(rules) {
    setGameSettings(rules)
    savePreferences({ gameSettings: rules })
  }

  function handleSetTableTheme(theme) {
    setTableTheme(theme)
    savePreferences({ tableThemeId: theme.id })
  }

  function handleSetDeckTheme(theme) {
    setDeckTheme(theme)
    savePreferences({ deckThemeId: theme.id })
  }

  function handleAuthed(authedUser) {
    setUser(authedUser)
    setModal(null)
  }

  async function handleSignOut() {
    await signOut()
    setUser(null)
    setModal(null)
    setView('landing')
  }

  function handleEnterRoom(room) {
    setActiveRoom(room)
    setModal(null)
    setView(room.status === 'playing' ? 'game' : 'room-waiting')
  }

  function handleRoomStart(room) {
    setActiveRoom(room)
    setView('game')
  }

  function exitToLanding() {
    setActiveRoom(null)
    setView('landing')
  }

  const quickGamePlayers = {
    bottom: { username: profile?.username || user?.email?.split('@')[0] || 'You', avatar_url: profile?.avatar_url },
    left: { username: BOT_NAMES[0], isBot: true },
    top: { username: BOT_NAMES[1], isBot: true },
    right: { username: BOT_NAMES[2], isBot: true },
  }

  const mySeat = activeRoom?.players.find((p) => p.id === user?.id)?.seat ?? 0

  return (
    <div className="h-screen w-screen">
      {view === 'landing' && (
        <Landing
          user={user}
          profile={profile}
          onPlayOnline={() => setModal('lobby')}
          onQuickGame={startQuickGame}
          onOpenAuth={() => setModal('auth')}
          onOpenDeckThemes={() => setModal('deckThemes')}
          onOpenTableThemes={() => setModal('tableThemes')}
          onOpenRules={() => setModal('rules')}
          onOpenChallenges={() => setModal('challenges')}
          onOpenProfile={() => (user ? setModal('profile') : setModal('auth'))}
          onOpenLeaderboard={() => setModal('leaderboard')}
        />
      )}

      {view === 'room-waiting' && activeRoom && (
        <RoomWaitingScreen room={activeRoom} myUserId={user?.id} onStart={handleRoomStart} onLeave={exitToLanding} />
      )}

      {view === 'game' && activeRoom && (
        <GameTable
          mode="multiplayer"
          room={activeRoom}
          myUserId={user?.id}
          authUser={user}
          profile={profile}
          onProfileUpdate={setProfile}
          onSignOut={handleSignOut}
          mySeat={mySeat}
          players={buildPlayersMap(activeRoom.players)}
          settings={fromDbSettings(activeRoom.settings)}
          tableTheme={tableTheme}
          deckTheme={deckTheme}
          onChangeTableTheme={handleSetTableTheme}
          onChangeDeckTheme={handleSetDeckTheme}
          onExit={exitToLanding}
        />
      )}

      {view === 'game' && !activeRoom && (
        <GameTable
          mode="solo"
          myUserId={user?.id}
          authUser={user}
          profile={profile}
          onProfileUpdate={setProfile}
          onSignOut={handleSignOut}
          players={quickGamePlayers}
          settings={gameSettings}
          tableTheme={tableTheme}
          deckTheme={deckTheme}
          onChangeTableTheme={handleSetTableTheme}
          onChangeDeckTheme={handleSetDeckTheme}
          onExit={exitToLanding}
        />
      )}

      {modal === 'auth' && (
        <AuthModal
          onClose={() => setModal(null)}
          onAuthed={handleAuthed}
          onGuest={() => setModal(null)}
        />
      )}

      {modal === 'lobby' && (
        <LobbyModal
          user={user}
          profile={profile}
          defaultRules={gameSettings}
          onClose={() => setModal(null)}
          onRequireAuth={() => setModal('auth')}
          onEnterRoom={handleEnterRoom}
        />
      )}

      {modal === 'challenges' && <ChallengesModal user={user} onClose={() => setModal(null)} />}

      {modal === 'profile' && user && (
        <ProfileModal
          user={user}
          profile={profile}
          onClose={() => setModal(null)}
          onProfileUpdate={setProfile}
          onSignOut={handleSignOut}
        />
      )}

      {modal === 'leaderboard' && <LeaderboardModal currentUserId={user?.id} onClose={() => setModal(null)} />}

      {modal === 'rules' && (
        <RulesModal
          initialRules={gameSettings}
          onClose={() => setModal(null)}
          onSave={(rules) => {
            handleSaveRules(rules)
            setModal(null)
          }}
        />
      )}

      {modal === 'tableThemes' && (
        <TableThemesModal
          selectedId={tableTheme.id}
          onSelect={(t) => {
            handleSetTableTheme(t)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'deckThemes' && (
        <DeckThemesModal
          selectedId={deckTheme.id}
          onSelect={(d) => {
            handleSetDeckTheme(d)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  )
}
