import { useEffect, useState } from 'react'
import { isAiAccount, loadBotAccounts } from '../../lib/bots'

// A small "AI" tag next to the name of one of the AI players (Big Dre,
// Keisha, …), so nobody in the family mistakes them for a person. With no
// `id` it always shows (the caller already knows).
export default function AiChip({ id }) {
  const [, setReady] = useState(0)
  useEffect(() => {
    if (id) loadBotAccounts().then(() => setReady((n) => n + 1))
  }, [id])
  if (id && !isAiAccount(id)) return null
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-px text-[10px] font-extrabold tracking-[0.12em] leading-[1.5]"
      style={{ color: '#f1d28a', background: 'rgb(212 166 74 / 0.14)', border: '1px solid rgb(212 166 74 / 0.45)' }}
      title="AI player"
    >
      AI
    </span>
  )
}
