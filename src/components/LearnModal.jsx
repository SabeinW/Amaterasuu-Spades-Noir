// Learn to play: a short walk through Spades for people who've never played,
// in your own deck, with a few "which card wins?" taps along the way. It
// follows your house rules (Jokers & Deuces, Nil, the board rule…) and ends by
// starting a coached practice game.
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, GraduationCap, X } from 'lucide-react'
import Sheet from './ui/Sheet'
import Card from './cards/Card'
import * as E from '../lib/engine'

const c = (id) => {
  if (id === 'BJ') return { suit: 'JOKER', value: 'BIG', id: 'JOKER_BIG' }
  if (id === 'LJ') return { suit: 'JOKER', value: 'SMALL', id: 'JOKER_SMALL' }
  return { suit: id.slice(-1), value: id.slice(0, -1), id }
}
const NAMES = ['Nyx', 'Kestrel', 'Osiris', 'You'] // left, partner (top), right, you

function buildSteps(rules) {
  const r = E.normalizeRules(rules)
  const steps = [
    {
      title: 'Two teams of two',
      body: ['Spades is played by four people in two teams.', 'Your partner sits across from you. The players on your left and right are the other team.'],
      visual: { kind: 'seats' },
    },
    {
      title: 'How a trick works',
      body: ['Everyone gets 13 cards. One player leads a card, then each player plays one card, going around the table. Those four cards are a trick.', 'The highest card of the suit that was led wins the trick.'],
      visual: { kind: 'trick', cards: ['7H', 'KH', '4H', '10H'], win: 1, caption: 'Hearts were led, and the K♥ is the highest heart: Kestrel wins.' },
    },
    {
      title: 'Follow suit',
      body: ['If you have a card of the suit that was led, you must play one.', "If you don't have that suit, you can play any card."],
      visual: { kind: 'hand', cards: ['KH', '9H', 'AD', '6C', '5S'], lit: ['KH', '9H'], caption: 'Hearts were led: only your hearts can be played.' },
    },
    {
      title: 'Your turn: which card wins?',
      body: ['Tap the card that wins this trick.'],
      visual: { kind: 'quiz', cards: ['9H', 'QH', 'AD', '3H'], win: 1, why: 'The Q♥. The A♦ is higher, but it isn’t a heart, so it can’t win a hearts trick.' },
    },
    {
      title: 'Spades are trump',
      body: ['A spade beats any heart, diamond or club. That’s called trumping (or cutting).', 'You can only trump when you’re out of the suit that was led.'],
      visual: { kind: 'trick', cards: ['KD', 'AD', '3S', '10D'], win: 2, caption: 'Osiris had no diamonds and played the 3♠. Even a small spade wins.' },
    },
    {
      title: 'Your turn: which card wins?',
      body: ['Clubs were led. Tap the winner.'],
      visual: { kind: 'quiz', cards: ['AC', '4S', 'KC', '9S'], win: 3, why: 'The 9♠. Both spades beat the clubs, and the higher spade wins.' },
    },
  ]
  if (r.spadesBreak) {
    steps.push({
      title: 'Breaking spades',
      body: ['You can’t lead a spade until someone has trumped with one. Then spades are “broken” and anyone can lead them.', 'The one exception: if spades are all you have left, you can lead one.'],
      visual: { kind: 'note', text: 'The score bar shows ♠ Broken once a spade has been played.' },
    })
  }
  if (r.jokers) {
    steps.push(
      {
        title: 'Jokers & Deuces',
        body: ['Your table plays with Jokers. The top trumps, highest first: Big Joker, Little Joker, 2♦, 2♠, then A♠, K♠ and on down.', 'All of them count as spades, even the 2♦. The 2♣ and 2♥ are taken out.'],
        visual: { kind: 'ladder', cards: ['BJ', 'LJ', '2D', '2S', 'AS', 'KS'] },
      },
      {
        title: 'Your turn: which card wins?',
        body: ['Spades were led. Tap the winner.'],
        visual: { kind: 'quiz', cards: ['AS', '2S', 'KS', 'LJ'], win: 3, why: 'The Little Joker. It’s above the 2♠, which is above the A♠.' },
      },
      {
        title: 'A tricky one',
        body: ['Diamonds were led. Tap the winner.'],
        visual: { kind: 'quiz', cards: ['AD', 'KD', '2D', 'QD'], win: 2, why: 'The 2♦! With Jokers & Deuces it counts as a spade, so it trumps the diamonds.' },
      }
    )
  }
  steps.push({
    title: 'Bidding',
    body: [
      'After the deal, everyone says how many tricks they think they’ll win. Your bid plus your partner’s is your team’s target.',
      'Count your likely winners: Jokers and high spades, aces, and kings with another card of the same suit.',
      ...(r.boardRule ? [`House rule: your team must bid at least ${r.boardMinimum} together.`] : []),
    ],
    visual: { kind: 'hand', cards: r.jokers ? ['BJ', 'AS', '7S', 'AH', '9H', 'KD', '5D', '8C'] : ['AS', 'KS', '7S', 'AH', '9H', 'KD', '5D', '8C'], lit: r.jokers ? ['BJ', 'AS', 'AH', 'KD'] : ['AS', 'KS', 'AH', 'KD'], caption: 'Four likely winners: bid about 4.' },
  })
  steps.push({
    title: 'Scoring',
    body: [
      `Make your bid: 10 points for each trick you bid. Bid 5, take 5: +50.`,
      `Extra tricks are “bags”: +1 each${r.bagPenalty ? `, but every ${r.bagLimit} bags costs 100` : ''}.`,
      'Miss your bid: lose 10 for each trick you bid. Bid 5, take 4: −50.',
      `The first team to ${r.winScore} wins${r.losingScore ? `, and a team that sinks to ${r.losingScore} loses` : ''}.`,
    ],
    visual: { kind: 'note', text: 'Bidding too low collects bags; bidding too high loses points. Aim for what you can really win.' },
  })
  if (r.nil) {
    steps.push({
      title: 'Nil',
      body: [
        `Weak hand? Bid Nil: you promise to win zero tricks. Do it and your team gets +${r.nilBonus}. Win even one and it’s −${r.nilBonus}.`,
        'Your partner helps by winning the tricks you’d otherwise be stuck with.',
        ...(r.blindNil ? [`Blind Nil: bid Nil before you look at your cards, for ±${r.nilBonus * 2}.`] : []),
      ],
      visual: { kind: 'hand', cards: ['3S', '6H', '4H', '8D', '5D', '3C', '7C'], lit: [], caption: 'No high cards and few spades: a Nil hand.' },
    })
  }
  steps.push({
    title: 'You’re ready',
    body: [
      'Play a coached game against the AI. The coach reads your hand at bidding time, rings the card it would play in gold, and shows how the points add up after each round.',
      'Your partner in practice is Kestrel. Turn the coach on or off any time from the table menu.',
    ],
    visual: { kind: 'ready' },
  })
  return steps
}

function Seats() {
  const box = (name, sub, tone) => (
    <div className="rounded-xl px-3 py-1.5 text-center" style={{ background: tone === 'us' ? 'rgb(212 166 74 / 0.18)' : 'rgb(243 234 219 / 0.06)', border: `1px solid ${tone === 'us' ? 'rgb(241 210 138 / 0.6)' : 'rgb(243 234 219 / 0.15)'}` }}>
      <p className="text-[13px] font-bold">{name}</p>
      <p className="text-[10.5px] text-faint">{sub}</p>
    </div>
  )
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-2 items-center justify-items-center rounded-2xl p-3" style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgb(40 70 50 / 0.5), rgb(0 0 0 / 0.2))' }}>
      <div />
      {box('Kestrel', 'your partner', 'us')}
      <div />
      {box('Nyx', 'other team')}
      <p className="text-[11px] text-faint text-center">the table</p>
      {box('Osiris', 'other team')}
      <div />
      {box('You', 'your team', 'us')}
      <div />
    </div>
  )
}

// One line of cards. `overlap` tucks each card under the next, like a hand.
function Row({ ids, width, render, overlap = false }) {
  return (
    <div className={`flex justify-center ${overlap ? '' : 'gap-1.5'}`}>
      {ids.map((id, i) => (
        <div key={id} style={overlap && i ? { marginLeft: -width * 0.36 } : undefined}>
          {render(c(id), i, width)}
        </div>
      ))}
    </div>
  )
}

// Fits n cards across the sheet (sheet padding is 20px a side).
function fitWidth(n, overlap) {
  const avail = Math.min(window.innerWidth, 640) - 48
  const w = overlap ? avail / (1 + 0.64 * (n - 1)) : (avail - 6 * (n - 1)) / n
  return Math.floor(Math.min(overlap ? 60 : 70, w))
}

function Trick({ v, deck, width }) {
  return (
    <div>
      <Row
        ids={v.cards}
        width={width}
        render={(card, i) => (
          <div key={card.id} className="flex flex-col items-center gap-1">
            <div className="relative" style={{ borderRadius: 8, boxShadow: i === v.win ? '0 0 0 2.5px #f1d28a' : undefined, opacity: i === v.win ? 1 : 0.75 }}>
              <Card card={card} deck={deck} width={width} still thumb />
            </div>
            <span className={`text-[11px] ${i === v.win ? 'text-gold-hi font-bold' : 'text-faint'}`}>
              {NAMES[i]}
              {i === 0 ? ' · led' : ''}
            </span>
          </div>
        )}
      />
      <p className="text-center text-[13px] text-paper/90 mt-3">{v.caption}</p>
    </div>
  )
}

function Quiz({ v, deck, width }) {
  const [pick, setPick] = useState(null)
  const right = pick === v.win
  return (
    <div>
      <Row
        ids={v.cards}
        width={width}
        render={(card, i) => {
          const ring = pick === null ? undefined : i === v.win ? '0 0 0 2.5px #9ff0b0' : i === pick ? '0 0 0 2.5px #ff8a72' : undefined
          return (
            <button key={card.id} type="button" className="flex flex-col items-center gap-1" onClick={() => setPick(i)} aria-label={`${E.cardLabel(card)}, played by ${NAMES[i]}`}>
              <div style={{ borderRadius: 8, boxShadow: ring }}>
                <Card card={card} deck={deck} width={width} still thumb />
              </div>
              <span className="text-[11px] text-faint">
                {NAMES[i]}
                {i === 0 ? ' · led' : ''}
              </span>
            </button>
          )
        }}
      />
      <AnimatePresence mode="wait">
        {pick === null ? (
          <motion.p key="ask" className="text-center text-[13px] text-muted mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Tap a card.
          </motion.p>
        ) : (
          <motion.div key={pick} className="mt-3 rounded-2xl px-3 py-2.5 text-[13px]" style={{ background: right ? 'rgb(80 160 100 / 0.15)' : 'rgb(224 68 46 / 0.12)', border: `1px solid ${right ? 'rgb(159 240 176 / 0.45)' : 'rgb(255 138 114 / 0.45)'}` }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <p className="font-bold flex items-center gap-1.5" style={{ color: right ? '#9ff0b0' : '#ff8a72' }}>
              {right ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />} {right ? 'Right!' : 'Not quite.'}
            </p>
            <p className="text-paper/90 mt-0.5">{v.why}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Visual({ v, deck }) {
  const width = fitWidth(Math.max(4, v.cards?.length ?? 4), false)
  if (v.kind === 'seats') return <Seats />
  if (v.kind === 'trick') return <Trick v={v} deck={deck} width={width} />
  if (v.kind === 'quiz') return <Quiz v={v} deck={deck} width={width} />
  if (v.kind === 'ladder' || v.kind === 'hand') {
    const lit = v.lit ? new Set(v.lit) : null
    const hand = v.kind === 'hand'
    const w = fitWidth(v.cards.length, hand)
    return (
      <div>
        <Row
          ids={v.cards}
          width={w}
          overlap={hand}
          render={(card, i) => (
            <div key={card.id} className="flex flex-col items-center gap-1" style={{ opacity: lit && !lit.has(card.id) ? 0.4 : 1 }}>
              <div style={{ borderRadius: 8, boxShadow: lit?.has(card.id) ? '0 0 0 2.5px #f1d28a' : undefined }}>
                <Card card={card} deck={deck} width={w} still thumb />
              </div>
              {v.kind === 'ladder' && <span className="text-[10.5px] text-faint">{i + 1}</span>}
            </div>
          )}
        />
        {v.caption && <p className="text-center text-[13px] text-paper/90 mt-3">{v.caption}</p>}
      </div>
    )
  }
  if (v.kind === 'note') return <p className="rounded-2xl px-3 py-2.5 text-[13px] text-paper/90" style={{ background: 'rgb(241 210 138 / 0.08)', border: '1px solid rgb(241 210 138 / 0.28)' }}>{v.text}</p>
  if (v.kind === 'ready')
    return (
      <div className="flex justify-center py-2">
        <span className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgb(212 166 74 / 0.14)', border: '1px solid rgb(212 166 74 / 0.35)' }}>
          <GraduationCap className="w-8 h-8 text-gold-hi" />
        </span>
      </div>
    )
  return null
}

export default function LearnModal({ rules, deck, onClose, onPlayCoached }) {
  const steps = useMemo(() => buildSteps(rules), [rules])
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1
  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={`Learn to play · ${i + 1} of ${steps.length}`}
      title={step.title}
      footer={
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !px-4" disabled={i === 0} onClick={() => setI((n) => n - 1)} aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {last ? (
            <button className="btn btn-gold flex-1" onClick={onPlayCoached}>
              <GraduationCap className="w-4 h-4" /> Play a coached game
            </button>
          ) : (
            <button className="btn btn-gold flex-1" onClick={() => setI((n) => n + 1)}>
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      }
    >
      <div className="flex gap-1 mb-4" aria-hidden="true">
        {steps.map((_, k) => (
          <span key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? 'var(--gold-leaf)' : 'rgb(243 234 219 / 0.12)' }} />
        ))}
      </div>
      <motion.div key={i} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }}>
        <div className="flex flex-col gap-2 text-[14px] leading-relaxed text-paper/90 mb-4">
          {step.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <Visual key={i} v={step.visual} deck={deck} />
        {i === 0 && (
          <button className="mt-4 w-full text-center text-[12.5px] text-gold font-semibold" onClick={onPlayCoached}>
            Already know the basics? Skip to a coached game
          </button>
        )}
      </motion.div>
    </Sheet>
  )
}
