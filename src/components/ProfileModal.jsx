import { useEffect, useRef, useState } from 'react'
import { X, Pencil, Check, LogOut, UserPlus, UserMinus, UserCheck, UserX, Search, Lock, Camera, RotateCcw } from 'lucide-react'
import { AVATAR_EMOJIS, AVATAR_COLORS, PROFILE_BORDERS, parseAvatar, serializeAvatar, fileToAvatarDataUrl, borderStyle, DEFAULT_AVATAR } from '../data/avatars'
import { ACHIEVEMENTS, TIER_STYLE, tierForCount } from '../data/achievements'
import { updateProfile } from '../lib/auth'
import {
  listFriends,
  searchProfiles,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  fetchAchievementCounts,
} from '../lib/social'

const TABS = ['Overview', 'Achievements', 'Friends']

function AvatarBadge({ avatar, size = 16 }) {
  const px = size * 4
  const inner = avatar.kind === 'photo' ? (
    <img src={avatar.url} alt="" className="rounded-full object-cover shrink-0 block" style={{ width: px, height: px }} />
  ) : (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: px, height: px, background: `${avatar.color}33`, border: `1px solid ${avatar.color}66` }}
    >
      <span style={{ fontSize: size * 2 }}>{avatar.emoji}</span>
    </div>
  )
  if (!avatar.border) return inner
  return <div style={borderStyle(avatar.border, px)}>{inner}</div>
}

export default function ProfileModal({ user, profile, onClose, onProfileUpdate, onSignOut }) {
  const [tab, setTab] = useState('Overview')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [achievementCounts, setAchievementCounts] = useState({})
  const [friendsData, setFriendsData] = useState({ friends: [], incoming: [], outgoing: [] })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const avatar = parseAvatar(profile?.avatar_url)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    fetchAchievementCounts(user.id).then(setAchievementCounts)
    listFriends(user.id).then(setFriendsData)
  }, [user?.id])

  async function saveAvatarUrl(avatarUrl) {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfile(user.id, { avatar_url: avatarUrl })
      onProfileUpdate?.(updated)
      setPickerOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveAvatar(nextAvatar) {
    await saveAvatarUrl(serializeAvatar(nextAvatar))
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      // Preserve whatever border is already set instead of dropping it.
      await saveAvatar({ kind: 'photo', url: dataUrl, border: avatar.border })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function setBorder(borderId) {
    await saveAvatar({ ...avatar, border: avatar.border === borderId ? null : borderId })
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput === profile?.username) {
      setEditingName(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfile(user.id, { username: nameInput.trim() })
      onProfileUpdate?.(updated)
      setEditingName(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function runSearch(q) {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    const found = await searchProfiles(q, user.id)
    setResults(found)
    setSearching(false)
  }

  async function refreshFriends() {
    const data = await listFriends(user.id)
    setFriendsData(data)
  }

  async function handleAddFriend(friendId) {
    await sendFriendRequest(user.id, friendId)
    await refreshFriends()
  }

  async function handleRespond(rowId, accept) {
    await respondToFriendRequest(rowId, accept)
    await refreshFriends()
  }

  async function handleRemoveFriend(rowId) {
    await removeFriend(rowId)
    await refreshFriends()
  }

  const winRate = profile?.total_games ? Math.round(((profile.wins ?? 0) / profile.total_games) * 100) : 0

  const stats = [
    { label: 'Rating', value: profile?.elo_rating ?? 1200 },
    { label: 'Games', value: profile?.total_games ?? 0 },
    { label: 'Wins', value: profile?.wins ?? 0 },
    { label: 'Losses', value: profile?.losses ?? 0 },
    { label: 'Win Rate', value: `${winRate}%` },
    { label: 'Best Streak', value: profile?.best_streak ?? 0 },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp bg-slate-900/90 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setPickerOpen((v) => !v)} className="relative" aria-label="Change avatar">
              <AvatarBadge avatar={avatar} size={16} />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <Pencil className="w-2.5 h-2.5 text-white/70" />
              </span>
            </button>
            <div>
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    className="rounded-lg bg-white/10 border border-white/20 text-sm px-2 py-1 outline-none w-32"
                  />
                  <button onClick={saveName} disabled={saving} className="text-emerald-400">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditingName(true); setNameInput(profile?.username ?? '') }} className="flex items-center gap-1.5">
                  <h3 className="font-display font-bold">{profile?.username ?? 'Player'}</h3>
                  <Pencil className="w-3 h-3 text-white/30" />
                </button>
              )}
              <p className="text-xs text-white/40">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {pickerOpen && (
          <div className="mb-4 rounded-xl bg-white/5 p-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            <div className="flex gap-1.5 mb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" /> Upload Photo
              </button>
              {avatar.kind === 'photo' && (
                <button
                  onClick={() => saveAvatar({ ...DEFAULT_AVATAR, border: avatar.border })}
                  disabled={saving}
                  title="Remove photo"
                  aria-label="Remove photo"
                  className="rounded-lg px-3 bg-white/5 hover:bg-white/10 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white/60" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/30 -mt-1 mb-3">Photos and GIFs both work — GIFs keep their animation.</p>
            <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase mb-2">Or Pick an Emoji</p>
            <div className="grid grid-cols-8 gap-1.5 mb-3">
              {AVATAR_EMOJIS.map((emoji) => {
                const base = avatar.kind === 'emoji' ? avatar : { ...DEFAULT_AVATAR, border: avatar.border }
                const active = avatar.kind === 'emoji' && emoji === avatar.emoji
                return (
                  <button
                    key={emoji}
                    onClick={() => saveAvatar({ ...base, emoji })}
                    className="aspect-square rounded-lg flex items-center justify-center text-lg"
                    style={{ background: active ? `${base.color}44` : 'rgba(255,255,255,0.05)', border: active ? `1px solid ${base.color}` : '1px solid transparent' }}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-1.5">
              {AVATAR_COLORS.map((color) => {
                const base = avatar.kind === 'emoji' ? avatar : { ...DEFAULT_AVATAR, border: avatar.border }
                return (
                  <button
                    key={color}
                    onClick={() => saveAvatar({ ...base, color })}
                    className="w-6 h-6 rounded-full shrink-0"
                    style={{ background: color, border: avatar.kind === 'emoji' && color === avatar.color ? '2px solid white' : '2px solid transparent' }}
                    aria-label={`Avatar color ${color}`}
                  />
                )
              })}
            </div>
            <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase mt-3 mb-2">Border</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBorder(null)}
                disabled={saving}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] text-white/50 shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)', border: !avatar.border ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent' }}
                aria-label="No border"
              >
                None
              </button>
              {PROFILE_BORDERS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBorder(b.id)}
                  disabled={saving}
                  title={b.name}
                  aria-label={`${b.name} border`}
                  className="w-8 h-8 rounded-full shrink-0"
                  style={{
                    ...borderStyle(b.id, 32),
                    outline: avatar.border === b.id ? '2px solid white' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-slate-900" />
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex rounded-xl bg-white/5 p-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-lg py-2 text-xs font-semibold"
              style={{ background: tab === t ? 'rgba(167,139,250,0.2)' : 'transparent', color: tab === t ? '#c4b5fd' : 'rgba(255,255,255,0.4)' }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'Achievements' && (
          <div className="grid grid-cols-2 gap-2.5">
            {ACHIEVEMENTS.map((a) => {
              const count = achievementCounts[a.id] ?? 0
              const unlocked = count > 0
              const tier = TIER_STYLE[tierForCount(count)]
              return (
                <div
                  key={a.id}
                  className="relative rounded-xl p-3 flex flex-col items-center text-center gap-1"
                  style={{ background: unlocked ? `${(tier?.ring ?? a.color)}18` : 'rgba(255,255,255,0.04)', border: unlocked ? `1px solid ${(tier?.ring ?? a.color)}55` : '1px solid transparent', opacity: unlocked ? 1 : 0.5 }}
                >
                  {tier && (
                    <span
                      className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${tier.ring}33`, color: tier.ring }}
                    >
                      {tier.label}
                    </span>
                  )}
                  <span className="text-2xl">{unlocked ? a.icon : <Lock className="w-5 h-5 text-white/30" />}</span>
                  <p className="text-xs font-semibold">{a.title}</p>
                  <p className="text-[10px] text-white/40 leading-tight">{a.description}</p>
                  {a.repeatable && count > 1 && <p className="text-[9px] text-white/30">Earned ×{count}</p>}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'Friends' && (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Search by username…"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-sm pl-9 pr-3 py-2.5 outline-none placeholder:text-white/25"
              />
              {searching && <p className="text-[10px] text-white/30 mt-1">Searching…</p>}
              {results.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AvatarBadge avatar={parseAvatar(r.avatar_url)} size={8} />
                        <span className="text-sm">{r.username}</span>
                      </div>
                      <button onClick={() => handleAddFriend(r.id)} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                        <UserPlus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {friendsData.incoming.length > 0 && (
              <div>
                <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase mb-2">Requests</p>
                <div className="flex flex-col gap-1.5">
                  {friendsData.incoming.map((r) => (
                    <div key={r.rowId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AvatarBadge avatar={parseAvatar(r.avatar_url)} size={8} />
                        <span className="text-sm">{r.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRespond(r.rowId, true)} className="text-emerald-300"><UserCheck className="w-4 h-4" /></button>
                        <button onClick={() => handleRespond(r.rowId, false)} className="text-red-300"><UserX className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase mb-2">
                Friends {friendsData.friends.length > 0 && `(${friendsData.friends.length})`}
              </p>
              {friendsData.friends.length === 0 && friendsData.outgoing.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-4">No friends yet — search above to add some.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {friendsData.friends.map((f) => (
                    <div key={f.rowId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AvatarBadge avatar={parseAvatar(f.avatar_url)} size={8} />
                        <span className="text-sm">{f.username}</span>
                      </div>
                      <button onClick={() => handleRemoveFriend(f.rowId)} className="text-white/30 hover:text-red-300">
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {friendsData.outgoing.map((f) => (
                    <div key={f.rowId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 opacity-60">
                      <div className="flex items-center gap-2">
                        <AvatarBadge avatar={parseAvatar(f.avatar_url)} size={8} />
                        <span className="text-sm">{f.username}</span>
                      </div>
                      <span className="text-[10px] text-white/40">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-5 text-sm font-semibold bg-red-500/10 text-red-300 hover:bg-red-500/15 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )
}
