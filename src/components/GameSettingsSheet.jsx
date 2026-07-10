import { X, Layers, Palette, Volume2, VolumeX, LogOut, ChevronRight, UserCircle2 } from 'lucide-react'

export default function GameSettingsSheet({
  deckTheme,
  tableTheme,
  muted,
  onToggleMute,
  onChangeDeck,
  onChangeTable,
  onEditProfile,
  onLeave,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 animate-fadeUp bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold">Game Settings</h3>
            <p className="text-xs text-white/40">Customize your table without leaving the hand</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {onEditProfile && (
            <button
              onClick={onEditProfile}
              className="flex items-center gap-3 rounded-xl p-3 text-left bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <UserCircle2 className="w-4 h-4 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Edit Profile</p>
                <p className="text-[11px] text-white/40 truncate">Username, avatar & stats</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
            </button>
          )}

          <button
            onClick={onChangeDeck}
            className="flex items-center gap-3 rounded-xl p-3 text-left bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: deckTheme?.back ? `linear-gradient(135deg, ${deckTheme.back.from}, ${deckTheme.back.to})` : 'rgba(255,255,255,0.08)' }}
            >
              <Layers className="w-4 h-4 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Deck Theme</p>
              <p className="text-[11px] text-white/40 truncate">{deckTheme?.name ?? 'Default'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </button>

          <button
            onClick={onChangeTable}
            className="flex items-center gap-3 rounded-xl p-3 text-left bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: tableTheme?.tableStyle?.background ?? 'rgba(255,255,255,0.08)' }}
            >
              <Palette className="w-4 h-4 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Table Theme</p>
              <p className="text-[11px] text-white/40 truncate">{tableTheme?.name ?? 'Default'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </button>

          <button
            onClick={onToggleMute}
            className="flex items-center gap-3 rounded-xl p-3 text-left bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white/8" style={{ background: 'rgba(255,255,255,0.08)' }}>
              {muted ? <VolumeX className="w-4 h-4 text-white/80" /> : <Volume2 className="w-4 h-4 text-white/80" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Sound</p>
              <p className="text-[11px] text-white/40">{muted ? 'Muted' : 'On'}</p>
            </div>
          </button>
        </div>

        <button
          onClick={onLeave}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-red-500/10 text-red-300 hover:bg-red-500/15 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Leave Match
        </button>
      </div>
    </div>
  )
}
