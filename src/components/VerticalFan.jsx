export default function VerticalFan({ count = 13, side = 'left', color = '#38bdf8' }) {
  const posClass = side === 'left' ? 'left-8' : 'right-8'
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 ${posClass}`} style={{ width: 40, height: 120 }}>
      {Array.from({ length: Math.min(count, 13) }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-md"
          style={{
            width: 36,
            height: 26,
            top: i * 6,
            background: `linear-gradient(135deg, ${color}55, #0b0715 70%)`,
            border: `1px solid ${color}55`,
            backgroundImage: `repeating-linear-gradient(45deg, ${color}22 0, ${color}22 2px, transparent 2px, transparent 8px)`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
      ))}
    </div>
  )
}
