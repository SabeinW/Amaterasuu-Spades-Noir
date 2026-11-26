// /?gallery — every card family side by side (picture cards with their
// living effects, the illustrated Ace of Spades, a number card, Jokers).
import Card from './cards/Card'
import { ALL_DECKS } from '../data/tableThemes'
import { FAMILIES } from '../data/cardFamilies'

const ROW = [
  { suit: 'S', value: 'A', id: 'AS' },
  { suit: 'S', value: 'K', id: 'KS' },
  { suit: 'H', value: 'Q', id: 'QH' },
  { suit: 'D', value: 'J', id: 'JD' },
  { suit: 'C', value: '7', id: '7C' },
  { suit: 'D', value: '10', id: '10D' },
  { suit: 'JOKER', value: 'BIG', id: 'JOKER_BIG' },
  { suit: 'JOKER', value: 'SMALL', id: 'JOKER_SMALL' },
]

export default function CardGallery() {
  const shown = Object.keys(FAMILIES).map((f) => ALL_DECKS.find((d) => d.style === f && d.family === 'mythic') ?? ALL_DECKS.find((d) => d.style === f))
  return (
    <div className="fixed inset-0 overflow-y-auto lacquer p-4">
      <h1 className="text-2xl font-bold gold-text mb-4">Card families</h1>
      <div className="flex flex-col gap-5">
        {shown.filter(Boolean).map((deck) => (
          <div key={deck.id}>
            <p className="eyebrow mb-2">
              {FAMILIES[deck.style].name} · {deck.name}
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <Card faceDown deck={deck} width={84} />
              {ROW.map((c) => (
                <Card key={c.id} card={c} deck={deck} width={84} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
