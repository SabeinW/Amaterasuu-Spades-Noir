import { levelColor, levelForXp } from '../../data/levels'

// A small level medallion next to a player's name.
export default function LevelBadge({ xp, size = 'sm' }) {
  const level = levelForXp(xp ?? 0)
  const color = levelColor(level)
  const big = size === 'lg'
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-display font-extrabold tabular-nums ${big ? 'h-7 min-w-7 px-2 text-[13px]' : 'h-[18px] min-w-[18px] px-1.5 text-[10.5px]'}`}
      style={{ color, background: `${color}1c`, border: `1px solid ${color}66` }}
      title={`Level ${level}`}
    >
      <span className="sr-only">Level </span>
      {big ? `Lv ${level}` : level}
    </span>
  )
}
