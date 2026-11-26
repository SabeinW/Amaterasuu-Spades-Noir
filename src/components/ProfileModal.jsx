import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pencil, Check, LogOut, UserPlus, UserMinus, UserCheck, UserX, Search, Lock, Camera, RotateCcw } from 'lucide-react'
import Sheet from './ui/Sheet'
import Avatar from './ui/Avatar'
import { AVATAR_EMOJIS, AVATAR_COLORS, ART_AVATARS, PROFILE_BORDERS, parseAvatar, serializeAvatar, fileToAvatarDataUrl, borderStyle, DEFAULT_AVATAR, defaultArtAvatar } from '../data/avatars'
import { ACHIEVEMENTS, TIER_STYLE, tierForCount } from '../data/achievements'
import { rankProgress } from '../data/ranks'
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

const CARD = { background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(212 166 74 / 0.22)' }
const ROW = { background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(243 234 219 / 0.07)' }
const ACTIVE_RING = '0 0 0 2px #110e0b, 0 0 0 4px #f1d28a'
const EASE = [0.22, 1, 0.36, 1]

// The gold-ringed medallion, except when the player picked a profile border —
// then that border replaces the default gold ring.
function ProfileAvatar({ avatarUrl, name, size }) {
  const border = parseAvatar(avatarUrl).border
  if (!border) return <Avatar avatarUrl={avatarUrl} name={name} size={size} />
  return (
    <div className="shrink-0" style={{ ...borderStyle(border, size), width: size, height: size }}>
      <Avatar avatarUrl={avatarUrl} name={name} size={size - 4} ring={false} />
    </div>
  )
}

function Tabs({ value, onChange }) {
  const id = useId()
  return (
    <div role="tablist" aria-label="Profile sections" className="flex gap-1 p-1 rounded-[14px]" style={{ background: 'rgb(0 0 0 / 0.35)', border: '1px solid rgb(212 166 74 / 0.2)' }}>
      {TABS.map((t) => {
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t)}
            className="relative flex-1 min-w-0 min-h-11 rounded-[10px] px-1 text-[12.5px] min-[390px]:text-[13.5px] font-bold transition-colors"
            style={{ color: active ? '#1b1307' : 'rgb(243 234 219 / 0.62)' }}
          >
            {active && (
              <motion.span
                layoutId={`profile-tab-${id}`}
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'var(--gold-leaf)', boxShadow: '0 6px 16px -8px rgb(212 166 74 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.5)' }}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{t}</span>
          </button>
        )
      })}
    </div>
  )
}

// Gold-leaf progress bar on a lacquer track.
function Bar({ pct }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgb(0 0 0 / 0.4)', boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 0.6)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'var(--gold-leaf)', boxShadow: '0 0 10px rgb(241 210 138 / 0.35)' }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
      />
    </div>
  )
}

function PersonRow({ person, dim = false, children }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="flex items-center gap-3 rounded-2xl pl-2.5 pr-1.5 py-1.5 min-h-[58px]"
      style={ROW}
    >
      <ProfileAvatar avatarUrl={person.avatar_url} name={person.username} size={40} />
      <span className="flex-1 min-w-0 text-[14.5px] font-semibold truncate">{person.username}</span>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </motion.li>
  )
}

function SectionLabel({ children }) {
  return <p className="eyebrow mb-2 px-1">{children}</p>
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

  const avatar = profile?.avatar_url ? parseAvatar(profile.avatar_url) : defaultArtAvatar(profile?.username)
  // With no saved avatar the medallion shows a default face, so no emoji or
  // colour swatch should look selected yet.
  const hasAvatar = !!profile?.avatar_url
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
  const { current: rank, next: nextRank, progress: rankProgressPct, pointsToNext } = rankProgress(profile?.elo_rating ?? 1200)

  const stats = [
    { label: 'Rating', value: profile?.elo_rating ?? 1200 },
    { label: 'Games', value: profile?.total_games ?? 0 },
    { label: 'Wins', value: profile?.wins ?? 0 },
    { label: 'Losses', value: profile?.losses ?? 0 },
    { label: 'Win Rate', value: `${winRate}%` },
    { label: 'Best Streak', value: profile?.best_streak ?? 0 },
  ]

  const unlockedCount = ACHIEVEMENTS.filter((a) => (achievementCounts[a.id] ?? 0) > 0).length
  // Emoji and colour picks build on the current emoji avatar, or on the
  // default one (keeping the border) when the player has a photo.
  const emojiBase = avatar.kind === 'emoji' ? avatar : { ...DEFAULT_AVATAR, border: avatar.border }

  return (
    <Sheet open onClose={onClose} eyebrow="Player card" title="Profile">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="relative shrink-0 rounded-full"
          aria-label="Change avatar"
          aria-expanded={pickerOpen}
        >
          <ProfileAvatar avatarUrl={profile?.avatar_url} name={profile?.username} size={76} />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'var(--gold-leaf)', color: '#1b1307', boxShadow: '0 0 0 3px #110e0b, 0 4px 10px -4px rgb(0 0 0 / 0.8)' }}
          >
            {pickerOpen ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') {
                    // Cancel the rename without closing the whole sheet.
                    e.stopPropagation()
                    setEditingName(false)
                  }
                }}
                aria-label="Username"
                className="field !min-h-11 !px-3 text-base font-semibold"
              />
              <button onClick={saveName} disabled={saving} aria-label="Save username" className="btn btn-gold shrink-0 !min-h-11 !w-11 !px-0 !rounded-full">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingName(true)
                setNameInput(profile?.username ?? '')
              }}
              className="flex items-center gap-2 min-h-11 max-w-full text-left"
              title="Edit username"
            >
              <h3 className="font-display text-[22px] font-bold leading-tight truncate">{profile?.username ?? 'Player'}</h3>
              <Pencil className="w-3.5 h-3.5 text-gold shrink-0" aria-label="Edit username" />
            </button>
          )}
          <p className="text-[12.5px] text-faint truncate">{user?.email}</p>
          <span className="chip mt-2" style={{ color: rank.color, borderColor: `${rank.color}55`, background: `${rank.color}12` }}>
            <span aria-hidden="true">{rank.icon}</span>
            {rank.label}
          </span>
        </div>
      </div>

      {/* Avatar picker */}
      <AnimatePresence initial={false}>
        {pickerOpen && (
          <motion.div
            key="picker"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl p-3" style={CARD} aria-busy={saving}>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={saving} className="btn btn-ghost flex-1 !min-h-11 text-[13.5px]">
                  <Camera className="w-4 h-4 text-gold" /> Upload photo
                </button>
                {avatar.kind === 'photo' && (
                  <button
                    onClick={() => saveAvatar({ ...defaultArtAvatar(profile?.username), border: avatar.border })}
                    disabled={saving}
                    title="Remove photo"
                    aria-label="Remove photo"
                    className="btn btn-icon shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[11.5px] text-faint mt-2 px-0.5">
                Photos and GIFs both work — GIFs keep their animation.
                {saving && <span className="text-gold ml-1.5">Saving…</span>}
              </p>

              <p className="eyebrow mt-4 mb-2 px-0.5">Ink portraits</p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {ART_AVATARS.map((a) => {
                  const active = hasAvatar && avatar.kind === 'art' && avatar.src === a.src
                  return (
                    <button
                      key={a.id}
                      onClick={() => saveAvatar({ kind: 'art', src: a.src, border: avatar.border })}
                      disabled={saving}
                      aria-label={a.label}
                      aria-pressed={active}
                      className="relative aspect-square rounded-full p-0.5 transition-transform active:scale-95"
                      style={{ background: active ? 'linear-gradient(135deg,#f6dc9a,#8a6a2b)' : 'transparent' }}
                    >
                      <img src={a.src} alt="" className="w-full h-full rounded-full object-cover" loading="lazy" />
                    </button>
                  )
                })}
              </div>

              <p className="eyebrow mt-4 mb-2 px-0.5">Or pick an emoji</p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                {AVATAR_EMOJIS.map((emoji) => {
                  const active = hasAvatar && avatar.kind === 'emoji' && emoji === avatar.emoji
                  return (
                    <button
                      key={emoji}
                      onClick={() => saveAvatar({ ...emojiBase, emoji })}
                      aria-label={`Avatar ${emoji}`}
                      aria-pressed={active}
                      className="aspect-square rounded-xl flex items-center justify-center text-[22px] transition-colors hover:bg-white/[0.06]"
                      style={
                        active
                          ? { background: `${emojiBase.color}33`, border: '1px solid #f1d28a', boxShadow: '0 0 12px -2px rgb(241 210 138 / 0.45)' }
                          : { background: 'rgb(0 0 0 / 0.25)', border: '1px solid rgb(243 234 219 / 0.06)' }
                      }
                    >
                      {emoji}
                    </button>
                  )
                })}
              </div>

              <p className="eyebrow mt-4 mb-1 px-0.5">Colour</p>
              <div className="grid grid-cols-8">
                {AVATAR_COLORS.map((color) => {
                  const active = hasAvatar && avatar.kind === 'emoji' && color === avatar.color
                  return (
                    <button
                      key={color}
                      onClick={() => saveAvatar({ ...emojiBase, color })}
                      className="h-11 flex items-center justify-center"
                      aria-label={`Avatar color ${color}`}
                      aria-pressed={active}
                    >
                      <span className="w-7 h-7 rounded-full" style={{ background: color, boxShadow: active ? ACTIVE_RING : 'inset 0 0 0 1px rgb(255 255 255 / 0.18)' }} />
                    </button>
                  )
                })}
              </div>

              <p className="eyebrow mt-3 mb-1 px-0.5">Border</p>
              <div className="grid grid-cols-9">
                <button
                  onClick={() => setBorder(null)}
                  disabled={saving}
                  className="h-11 flex items-center justify-center disabled:opacity-50"
                  aria-label="No border"
                  aria-pressed={!avatar.border}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[8.5px] font-bold uppercase tracking-wide text-faint"
                    style={{ background: 'rgb(0 0 0 / 0.3)', border: '1px dashed rgb(243 234 219 / 0.25)', boxShadow: !avatar.border ? ACTIVE_RING : undefined }}
                  >
                    None
                  </span>
                </button>
                {PROFILE_BORDERS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBorder(b.id)}
                    disabled={saving}
                    title={b.name}
                    aria-label={`${b.name} border`}
                    aria-pressed={avatar.border === b.id}
                    className="h-11 flex items-center justify-center disabled:opacity-50"
                  >
                    <span
                      className="block w-8 h-8 rounded-full"
                      style={{ ...borderStyle(b.id, 32), outline: avatar.border === b.id ? '2px solid #f1d28a' : 'none', outlineOffset: 2 }}
                    >
                      <span className="block w-full h-full rounded-full bg-ink-2" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-verm-hi mt-3">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="mt-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {tab === 'Overview' && (
            <div className="flex flex-col gap-3">
              <div
                className="rounded-2xl p-4 flex flex-col items-center text-center"
                style={{ background: `radial-gradient(120% 90% at 50% 0%, ${rank.color}22, transparent 62%), rgb(243 234 219 / 0.03)`, border: `1px solid ${rank.color}55` }}
              >
                <motion.span
                  className="text-[40px] leading-none"
                  style={{ filter: `drop-shadow(0 0 10px ${rank.color}88)` }}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                >
                  {rank.icon}
                </motion.span>
                <p className="font-display text-xl font-extrabold mt-2" style={{ color: rank.color }}>
                  {rank.label}
                </p>
                {nextRank ? (
                  <div className="w-full mt-3">
                    <Bar pct={Math.round(rankProgressPct * 100)} />
                    <p className="text-[12px] text-muted mt-2">
                      <span className="font-display font-bold text-gold-hi tabular-nums">{pointsToNext}</span> rating to {nextRank.label}
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-muted mt-1">Max rank reached</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    className="rounded-2xl px-1.5 py-3 text-center"
                    style={ROW}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.03, duration: 0.3, ease: EASE }}
                  >
                    <p className={`font-display text-[22px] font-extrabold leading-none tabular-nums ${i === 0 ? 'gold-text' : 'text-paper'}`}>{s.value}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-faint leading-tight mt-1.5">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Achievements' && (
            <div>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <p className="eyebrow">Unlocked</p>
                <p className="font-display font-bold tabular-nums text-gold-hi text-[15px]">
                  {unlockedCount}
                  <span className="text-faint"> / {ACHIEVEMENTS.length}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ACHIEVEMENTS.map((a, i) => {
                  const count = achievementCounts[a.id] ?? 0
                  const unlocked = count > 0
                  const tier = TIER_STYLE[tierForCount(count)]
                  const tone = tier?.ring ?? a.color
                  return (
                    <motion.div
                      key={a.id}
                      className="relative rounded-2xl px-2.5 pt-4 pb-3 flex flex-col items-center text-center gap-1"
                      style={
                        unlocked
                          ? { background: `radial-gradient(100% 70% at 50% 0%, ${tone}1f, transparent 70%), rgb(243 234 219 / 0.03)`, border: `1px solid ${tone}55` }
                          : { background: 'rgb(243 234 219 / 0.025)', border: '1px solid rgb(243 234 219 / 0.06)' }
                      }
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: unlocked ? 1 : 0.55, y: 0 }}
                      transition={{ delay: Math.min(i, 16) * 0.02, duration: 0.3, ease: EASE }}
                    >
                      {tier && (
                        <span
                          className="absolute top-2 right-2 text-[8.5px] font-extrabold tracking-[0.12em] px-1.5 py-0.5 rounded-full"
                          style={{ background: `${tier.ring}26`, color: tier.ring, border: `1px solid ${tier.ring}55` }}
                        >
                          {tier.label}
                        </span>
                      )}
                      <span
                        className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
                        style={{ background: 'rgb(0 0 0 / 0.3)', border: `1px solid ${unlocked ? `${tone}55` : 'rgb(243 234 219 / 0.08)'}` }}
                      >
                        {unlocked ? a.icon : <Lock className="w-4 h-4 text-faint" />}
                      </span>
                      <p className={`text-[13px] font-bold leading-tight mt-1 ${unlocked ? 'text-paper' : 'text-muted'}`}>{a.title}</p>
                      <p className="text-[11px] text-faint leading-snug">{a.description}</p>
                      {a.repeatable && count > 1 && <p className="text-[10.5px] font-semibold text-gold mt-0.5">Earned ×{count}</p>}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'Friends' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="relative block">
                  <span className="sr-only">Search players by username</span>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/70 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => runSearch(e.target.value)}
                    placeholder="Search by username…"
                    enterKeyHint="search"
                    className="field !pl-11 text-base placeholder:text-faint"
                  />
                </label>
                {searching && <p className="text-[12px] text-faint mt-2 px-1">Searching…</p>}
                {results.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {results.map((r) => (
                      <PersonRow key={r.id} person={r}>
                        <button onClick={() => handleAddFriend(r.id)} className="btn btn-ghost !min-h-11 !px-3.5 !rounded-full text-[13px] !text-gold-hi">
                          <UserPlus className="w-4 h-4" /> Add
                        </button>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </div>

              {friendsData.incoming.length > 0 && (
                <div>
                  <SectionLabel>Requests ({friendsData.incoming.length})</SectionLabel>
                  <ul className="flex flex-col gap-1.5">
                    {friendsData.incoming.map((r) => (
                      <PersonRow key={r.rowId} person={r}>
                        <button onClick={() => handleRespond(r.rowId, true)} className="btn btn-icon" aria-label={`Accept ${r.username}`} title="Accept">
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRespond(r.rowId, false)} className="btn btn-icon !text-verm-hi" aria-label={`Decline ${r.username}`} title="Decline">
                          <UserX className="w-4 h-4" />
                        </button>
                      </PersonRow>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <SectionLabel>Friends {friendsData.friends.length > 0 && `(${friendsData.friends.length})`}</SectionLabel>
                {friendsData.friends.length === 0 && friendsData.outgoing.length === 0 ? (
                  <p className="text-[13px] text-faint text-center py-6">No friends yet — search above to add some.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {friendsData.friends.map((f) => (
                      <PersonRow key={f.rowId} person={f}>
                        <button onClick={() => handleRemoveFriend(f.rowId)} className="btn btn-icon !text-faint hover:!text-verm-hi" aria-label={`Remove ${f.username}`} title="Remove friend">
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </PersonRow>
                    ))}
                    {friendsData.outgoing.map((f) => (
                      <PersonRow key={f.rowId} person={f} dim>
                        <span className="chip mr-1.5">Pending</span>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="gold-rule mt-6 mb-4" />
      <button
        onClick={onSignOut}
        className="btn w-full !text-verm-hi transition-colors hover:!bg-verm/10"
        style={{ border: '1px solid rgb(224 68 46 / 0.35)', background: 'rgb(224 68 46 / 0.06)' }}
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
      <div aria-hidden="true" style={{ height: 'var(--safe-b)' }} />
    </Sheet>
  )
}
