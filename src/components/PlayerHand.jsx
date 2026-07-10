import PlayingCard from './PlayingCard'
import { isPlayable } from '../lib/cards'

export default function PlayerHand({
  cards,
  selectedCard,
  isMyTurn,
  currentTrick,
  spadesBroken,
  useJD,
  spadesBreakRule = true,
  onCardClick,
  accentColor,
  deckTheme,
  masked = false,
}) {
  if (!cards?.length) return null

  const mid = (cards.length - 1) / 2

  function arcTransform(i) {
    const offset = i - mid
    const rotate = Math.max(-16, Math.min(16, offset * 2.5))
    const lift = Math.abs(offset) ** 1.3 * 2.6
    return { transform: `rotate(${rotate}deg) translateY(${lift}px)`, transformOrigin: 'bottom center' }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase">Your Hand</p>
        <p className="text-[10px] text-white/30">
          {masked ? 'Hidden until you decide' : `${cards.length} cards — swipe to scroll`}
        </p>
      </div>
      <div data-testid="hand-row" className="flex items-end gap-2 overflow-x-auto overflow-y-visible no-scrollbar px-4 pb-4">
        {masked
          ? cards.map((card, i) => (
              <div key={card.id} className="shrink-0" style={arcTransform(i)}>
                <PlayingCard faceDown deckTheme={deckTheme} accentColor={accentColor} size="md" />
              </div>
            ))
          : cards.map((card, i) => {
              const playable = isMyTurn && isPlayable(card, cards, currentTrick, spadesBroken, useJD, spadesBreakRule)
              const selected = selectedCard?.id === card.id
              return (
                <div key={card.id} className="shrink-0" style={arcTransform(i)}>
                  <PlayingCard
                    suit={card.suit}
                    value={card.value}
                    selected={selected}
                    disabled={!isMyTurn || !playable}
                    accentColor={accentColor}
                    deckTheme={deckTheme}
                    onClick={() => onCardClick(card)}
                    style={{ animation: 'cardSlideIn 0.3s ease both' }}
                  />
                </div>
              )
            })}
      </div>
    </div>
  )
}
