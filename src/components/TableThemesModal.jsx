import { useRef, useState } from 'react'
import { X, Check, ArrowRight, Upload, Trash2 } from 'lucide-react'
import { TABLE_THEMES, MASTER_THEMES, fileToTableBackgroundDataUrl, customTableTheme, MAX_CUSTOM_TABLES } from '../data/tableThemes'

export default function TableThemesModal({ onClose, selectedId, onSelect, customTables = [], onDeleteCustom }) {
  const [view, setView] = useState('standard')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const dataUrl = await fileToTableBackgroundDataUrl(file)
      onSelect(customTableTheme(dataUrl))
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (view === 'master') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp" style={{ background: 'rgba(12,10,20,0.98)', border: '1px solid rgba(167,139,250,0.25)' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-display font-bold text-lg">8 Master Themes</h3>
              <p className="text-xs text-white/40">Hand-crafted premium palettes</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView('standard')} className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                Classic <ArrowRight className="w-3 h-3" />
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {MASTER_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="rounded-xl p-3 text-left aspect-[4/5] flex flex-col justify-end relative overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${t.accentColor}33, #0e0b16 75%)`, border: selectedId === t.id ? `2px solid ${t.accentColor}` : '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${t.accentColor}33`, color: t.accentColor }}>
                  {t.tag}
                </span>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-[10px] text-white/40 leading-tight">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp" style={{ background: 'rgba(12,10,20,0.98)', border: '1px solid rgba(167,139,250,0.25)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold">Table Themes</h3>
            <p className="text-xs text-white/40">Set the atmosphere for your game</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || customTables.length >= MAX_CUSTOM_TABLES}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mb-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px dashed rgba(167,139,250,0.5)' }}
        >
          <Upload className="w-4 h-4" />
          {uploading
            ? 'Uploading…'
            : customTables.length >= MAX_CUSTOM_TABLES
              ? `Saved ${MAX_CUSTOM_TABLES}/${MAX_CUSTOM_TABLES} — delete one to add more`
              : 'Upload Your Own Image or GIF'}
        </button>
        {uploadError && <p className="text-xs text-red-400 mb-2 text-center">{uploadError}</p>}
        <p className="text-[10px] text-white/30 text-center mb-4">Static images and GIFs both work — GIFs keep their animation. Save up to {MAX_CUSTOM_TABLES}.</p>

        <div className="flex flex-col gap-2.5 mb-4">
          {customTables.map((ct) => (
            <div
              key={ct.id}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: selectedId === ct.id ? `${ct.accentColor}18` : 'rgba(255,255,255,0.04)', border: selectedId === ct.id ? `1px solid ${ct.accentColor}88` : '1px solid transparent' }}
            >
              <button onClick={() => onSelect(ct)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                <div className="w-14 h-10 rounded-lg flex items-center justify-center text-white/80 shrink-0" style={ct.tableStyle}>
                  ♠
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{ct.name}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${ct.accentColor}33`, color: ct.accentColor }}>
                      CUSTOM
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40">{ct.description}</p>
                </div>
              </button>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: selectedId === ct.id ? ct.accentColor : 'transparent', border: selectedId === ct.id ? 'none' : '1px solid rgba(255,255,255,0.2)' }}
              >
                {selectedId === ct.id && <Check className="w-3.5 h-3.5 text-black" />}
              </div>
              <button onClick={() => onDeleteCustom?.(ct.id)} aria-label={`Delete ${ct.name}`} className="text-white/30 hover:text-red-300 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {TABLE_THEMES.map((t) => {
            const active = selectedId === t.id
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="flex items-center gap-3 rounded-xl p-3 text-left"
                style={{ background: active ? `${t.accentColor}18` : 'rgba(255,255,255,0.04)', border: active ? `1px solid ${t.accentColor}88` : '1px solid transparent' }}
              >
                <div className="w-14 h-10 rounded-lg flex items-center justify-center text-white/80" style={t.tableStyle}>
                  ♠
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{t.name}</p>
                    {t.tag && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${t.accentColor}33`, color: t.accentColor }}>
                        {t.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40">{t.description}</p>
                </div>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: active ? t.accentColor : 'transparent', border: active ? 'none' : '1px solid rgba(255,255,255,0.2)' }}
                >
                  {active && <Check className="w-3.5 h-3.5 text-black" />}
                </div>
              </button>
            )
          })}
        </div>

        <button onClick={() => setView('master')} className="w-full rounded-xl py-2.5 text-sm font-semibold bg-white/5 text-white/70 flex items-center justify-center gap-1.5">
          View 8 Master Themes <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
