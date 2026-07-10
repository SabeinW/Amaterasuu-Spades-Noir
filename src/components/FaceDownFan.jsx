export default function FaceDownFan({ count = 13, accentColor = '#a78bfa' }) {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex" style={{ width: 120, height: 40 }}>
      {Array.from({ length: Math.min(count, 13) }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-md"
          style={{
            width: 26,
            height: 36,
            left: i * 6,
            background: `linear-gradient(135deg, ${accentColor}55, #0b0715 70%)`,
            border: `1px solid ${accentColor}55`,
            backgroundImage: `repeating-linear-gradient(45deg, ${accentColor}22 0, ${accentColor}22 2px, transparent 2px, transparent 8px)`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
      ))}
    </div>
  )
}
