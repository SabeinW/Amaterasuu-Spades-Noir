import { useState } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

export default function GameChat({ messages = [], onSend, accentColor = '#a78bfa' }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 relative">
        {open ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
        {!open && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center" style={{ background: accentColor, color: '#0a0812' }}>
            {Math.min(messages.length, 9)}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-10 right-0 w-64 h-72 flex flex-col rounded-xl bg-black/85 backdrop-blur-xl border border-white/10 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {messages.length === 0 && <p className="text-white/30 text-xs text-center mt-8">No messages yet</p>}
            {messages.map((m, i) => (
              <p key={i} className="text-xs text-white/80">
                <span className="font-semibold" style={{ color: accentColor }}>
                  {m.author}:
                </span>{' '}
                {m.text}
              </p>
            ))}
          </div>
          <form onSubmit={submit} className="flex border-t border-white/10">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something…"
              className="flex-1 bg-transparent px-3 py-2 text-xs outline-none placeholder:text-white/25"
            />
            <button type="submit" className="px-3 text-white/50">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
