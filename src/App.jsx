import { useEffect, useState } from 'react'
import Landing from './components/Landing'
import AuthModal from './components/AuthModal'
import LobbyModal from './components/LobbyModal'
import ChallengesModal from './components/ChallengesModal'
import RulesModal from './components/RulesModal'
import TableThemesModal from './components/TableThemesModal'
import DeckThemesModal from './components/DeckThemesModal'
import GameTable from './components/GameTable'
import RoomWaitingScreen from './components/RoomWaitingScreen'
import { onAuthStateChange, getSession, signOut } from './lib/auth'
import { supabaseEnabled } from './lib/supabase'
import { fromDbSettings } from './lib/rooms'
import { POSITIONS } from './lib/cards'
import { TABLE_THEMES, DECK_THEMES } from './data/tableThemes'
import { DEFAULT_GAME_RULES } from './data/challenges'

const BOT_NAMES = ['Nyx', 'Kestrel', 'Osiris']

function seatToDataPos(seat) {
  return POSITIONS[((seat % 4) + 4) % 4]
}

function buildPlayersMap(players) {
  const map = {}
  for (const p of players) {
    map[seatToDataPos(p.seat)] = { username: p.name, isBot: !!p.isBot }
  }
  return map
}

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('landing') // landing | room-waiting | game
  const [modal, setModal] = useState(null) // auth | lobby | challenges | rules | tableThemes | deckThemes
  const [gameSettings, setGameSettings] = useState(DEFAULT_GAME_RULES)
  const [tableTheme, setTableTheme] = useState(TABLE_THEMES[0])
  const [deckTheme, setDeckTheme] = useState(DECK_THEMES[0])
  const [activeRoom, setActiveRoom] = useState(null)

  useEffect(() => {
    if (!supabaseEnabled) return
    getSession().then((session) => setUser(session?.user ?? null))
    const { data } = onAuthStateChange((session) => setUser(session?.user ?? null))
    return () => data?.subscription?.unsubscribe?.()
  }, [])

  function startQuickGame() {
    setActiveRoom(null)
    setView('game')
  }

  function handleAuthed(authedUser) {
    setUser(authedUser)
    setModal(null)
  }

  async function handleSignOut() {
    await signOut()
    setUser(null)
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
    bottom: { username: user?.email?.split('@')[0] ?? 'You' },
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
          onPlayOnline={() => setModal('lobby')}
          onQuickGame={startQuickGame}
          onOpenAuth={() => setModal('auth')}
          onOpenDeckThemes={() => setModal('deckThemes')}
          onOpenTableThemes={() => setModal('tableThemes')}
          onOpenRules={() => setModal('rules')}
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
          mySeat={mySeat}
          players={buildPlayersMap(activeRoom.players)}
          settings={fromDbSettings(activeRoom.settings)}
          tableTheme={tableTheme}
          deckTheme={deckTheme}
          onExit={exitToLanding}
        />
      )}

      {view === 'game' && !activeRoom && (
        <GameTable
          mode="solo"
          players={quickGamePlayers}
          settings={gameSettings}
          tableTheme={tableTheme}
          deckTheme={deckTheme}
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
          defaultRules={gameSettings}
          onClose={() => setModal(null)}
          onRequireAuth={() => setModal('auth')}
          onEnterRoom={handleEnterRoom}
        />
      )}

      {modal === 'challenges' && <ChallengesModal user={user} onClose={() => setModal(null)} />}

      {modal === 'rules' && (
        <RulesModal
          initialRules={gameSettings}
          onClose={() => setModal(null)}
          onSave={(rules) => {
            setGameSettings(rules)
            setModal(null)
          }}
        />
      )}

      {modal === 'tableThemes' && (
        <TableThemesModal
          selectedId={tableTheme.id}
          onSelect={(t) => {
            setTableTheme(t)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'deckThemes' && (
        <DeckThemesModal
          selectedId={deckTheme.id}
          onSelect={(d) => {
            setDeckTheme(d)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {user && view === 'landing' && (
        <button
          onClick={handleSignOut}
          className="fixed bottom-4 left-4 text-[11px] text-white/30 hover:text-white/60"
        >
          Sign out ({user.email})
        </button>
      )}
    </div>
  )
}
