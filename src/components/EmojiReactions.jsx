import { useState } from 'react'
import { Smile } from 'lucide-react'

const EMOJIS = [
  '😏', '👏', '😂', '😤', '🔥', '👍',
  '💀', '😭', '🤯', '😱', '🙌', '🤝',
  '👀', '💪', '🎉', '🥳', '😎', '🤔',
  '😬', '🫡', '🤡', '💯', '🐐', '🃏',
  '😈', '🥶', '🫢', '🤌', '🙈', '😩',
  '🚨', '👑', '🎯', '💰', '🧊', '⚡',
]

export default function EmojiReactions({ onReact }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
        <Smile className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute bottom-10 right-0 grid grid-cols-6 gap-1 bg-black/80 backdrop-blur-lg rounded-xl p-2 border border-white/10 w-[216px]">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(e)
                setOpen(false)
              }}
              className="text-lg hover:scale-125 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
