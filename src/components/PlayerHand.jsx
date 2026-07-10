import PlayingCard from './PlayingCard'
import { isPlayable } from '../lib/cards'

export default function PlayerHand({
  cards,
  selectedCard,
  isMyTurn,
  currentTrick,
  spadesBroken,
  useJD,
  onCardClick,
  accentColor,
  deckTheme,
}) {
  if (!cards?.length) return null

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase">Your Hand</p>
        <p className="text-[10px] text-white/30">{cards.length} cards — swipe to scroll</p>
      </div>
      <div data-testid="hand-row" className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
        {cards.map((card) => {
          const playable = isMyTurn && isPlayable(card, cards, currentTrick, spadesBroken, useJD)
          const selected = selectedCard?.id === card.id
          return (
            <PlayingCard
              key={card.id}
              suit={card.suit}
              value={card.value}
              selected={selected}
              disabled={!isMyTurn || !playable}
              accentColor={accentColor}
              deckTheme={deckTheme}
              onClick={() => onCardClick(card)}
              style={{ animation: 'cardSlideIn 0.3s ease both' }}
            />
          )
        })}
      </div>
    </div>
  )
}
