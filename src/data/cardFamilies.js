// Card families: each has its own illustrated court (J/Q/K, both Jokers and
// an illustrated Ace of Spades), its own paper, metal, number-card emblem and
// living effect — so decks differ from the front, not just the back.
//
// Every family's court features Black royals by default. The original
// East-Asian court art stays in /art/court/*.webp (court set 'og') for a
// later "choose your court" option.
//
//   paper:  card face for light stock (washi/ivory decks)
//   metal:  trim + emblem colour
//   motif:  emblem behind number-card suits (see cards/Motif.jsx)
//   effect: animated finish on picture cards, Aces and Jokers (cards/CardFx.jsx)
//   pips:   classic pip layout on number cards instead of one big suit
import { DEFAULT_TONE, toneFor } from '../lib/skinTone'

const paper = (a, b, c) => `radial-gradient(120% 90% at 30% 15%, ${a} 0%, ${b} 55%, ${c} 100%)`

export const FAMILIES = {
  sun: { id: 'sun', name: 'Sun Court', courtSet: 'sun-court', paper: paper('#fffaf0', '#f4ebdd', '#e9dcc4'), metal: '#d4a64a', motif: 'sun', effect: 'gold' },
  moon: { id: 'moon', name: 'Moon Court', courtSet: 'moon', paper: paper('#f7f8fc', '#e6eaf4', '#d3d9ea'), metal: '#9eabcb', motif: 'moon', effect: 'moon' },
  ember: { id: 'ember', name: 'Ember Court', courtSet: 'ember', paper: paper('#fff6ea', '#f6e2c8', '#e9c9a3'), metal: '#e0743a', motif: 'flame', effect: 'ember' },
  tide: { id: 'tide', name: 'Tide Court', courtSet: 'tide', paper: paper('#f4fbfc', '#e0eff2', '#c9e1e7'), metal: '#3f9fc4', motif: 'wave', effect: 'tide' },
  frost: { id: 'frost', name: 'Frost Court', courtSet: 'frost', paper: paper('#ffffff', '#eef5fa', '#dce9f2'), metal: '#8fc0de', motif: 'snow', effect: 'frost' },
  jade: { id: 'jade', name: 'Jade Court', courtSet: 'jade', paper: paper('#fafcf4', '#ebf0df', '#d9e3c8'), metal: '#4f9a6c', motif: 'leaf', effect: 'jade' },
  bloom: { id: 'bloom', name: 'Bloom Court', courtSet: 'bloom', paper: paper('#fff8f8', '#f7e7ea', '#edd2d8'), metal: '#d98aa2', motif: 'blossom', effect: 'bloom' },
  storm: { id: 'storm', name: 'Storm Court', courtSet: 'storm', paper: paper('#f8f7fc', '#e8e5f2', '#d5d0e6'), metal: '#8b7bf0', motif: 'bolt', effect: 'storm' },
  eclipse: { id: 'eclipse', name: 'Eclipse Court', courtSet: 'eclipse', paper: paper('#fbf6ec', '#efe3cc', '#e0cca8'), metal: '#c9962e', motif: 'eclipse', effect: 'eclipse' },
  aurora: { id: 'aurora', name: 'Aurora Court', courtSet: 'aurora', paper: paper('#f6fbfb', '#e4f0f0', '#d4e2ea'), metal: '#3fb8a8', motif: 'aurora', effect: 'aurora' },
  starfall: { id: 'starfall', name: 'Starfall Court', courtSet: 'starfall', paper: paper('#f8f7fb', '#e9e7f3', '#d8d4ea'), metal: '#c9a24d', motif: 'star', effect: 'starfall' },
  dune: { id: 'dune', name: 'Dune Court', courtSet: 'dune', paper: paper('#fff8ee', '#f5e6cf', '#e8d0ab'), metal: '#c98a3a', motif: 'dune', effect: 'dune' },
  cloudborn: { id: 'cloudborn', name: 'Cloudborn', courtSet: 'cloudborn', paper: paper('#ffffff', '#f3effc', '#e2d9f5'), metal: '#8f6fd6', motif: 'cloud', effect: 'cloud' },
  // Concrete Crowns (modern streetwear) and Capes & Chaos (original heroes and villains)
  shibuya: { id: 'shibuya', name: 'Shibuya Drip', courtSet: 'shibuya', paper: paper('#fbfbfe', '#efedf6', '#dedbec'), metal: '#e0409a', motif: 'drip', effect: 'neon' },
  uptown: { id: 'uptown', name: 'Uptown Royalty', courtSet: 'uptown', paper: paper('#fffaf2', '#f4ead8', '#e7d5b8'), metal: '#9e3b34', motif: 'crown', effect: 'mural' },
  heroes: { id: 'heroes', name: 'Hero League', courtSet: 'heroes', paper: paper('#ffffff', '#eef2fb', '#dbe3f3'), metal: '#2f62d8', motif: 'burst', effect: 'hero' },
  villains: { id: 'villains', name: 'Rogue Syndicate', courtSet: 'villains', paper: paper('#faf7f8', '#eee4e7', '#dccdd2'), metal: '#b51f35', motif: 'mask', effect: 'venom' },
  // Violet Vanguard: a personal deck of original purple heroes and villains
  violet: { id: 'violet', name: 'Violet Vanguard', courtSet: 'violet', paper: paper('#fbf8ff', '#efe6fb', '#ddd0f3'), metal: '#a46bff', motif: 'burst', effect: 'cosmic' },
  // Anime Nights: an original gothic academy under a laughing moon
  laughmoon: { id: 'laughmoon', name: 'Laughing Moon', courtSet: 'laughing-moon', paper: paper('#faf8fc', '#ece6f4', '#d8cfe8'), metal: '#9d8ad8', motif: 'grin', effect: 'moon' },
  classic: { id: 'classic', name: 'Classic Court', courtSet: 'classic', paper: 'linear-gradient(160deg, #fffdf7 0%, #f7f1e3 60%, #eee4cf 100%)', metal: '#c9a24d', motif: null, effect: null, pips: true },
}

export const familyOf = (deck) => FAMILIES[deck?.style] ?? FAMILIES.sun

// `thumb` asks for the small copy (QH-sm.webp); only the Queen of Hearts has
// one, for the little card that peeks out of each deck in the deck picker.
// `tone` is the player's skin tone (lib/skinTone.js): the court cards and
// Jokers have a copy per tone; the Ace of Spades has no people, so no copies.
export function courtImage(family, card, { thumb = false, tone = DEFAULT_TONE } = {}) {
  const base = `/art/court/${family.courtSet}`
  const t = toneFor(tone, family.courtSet, card.id)
  const dir = t === DEFAULT_TONE ? base : `${base}/${t}`
  if (card.suit === 'JOKER') return `${dir}/${card.value === 'BIG' ? 'JOKER_BIG' : 'JOKER_SMALL'}.webp`
  if (['J', 'Q', 'K'].includes(card.value)) return `${dir}/${card.value}${card.suit}${thumb && card.id === 'QH' ? '-sm' : ''}.webp`
  if (card.value === 'A' && card.suit === 'S') return `${base}/AS.webp`
  return null
}

// Warm the browser cache with a deck's back and the court cards the deck
// picker shows, so picking a deck never opens on empty frames.
const warmed = new Set()
export function preloadDeckArt(deck, tone = DEFAULT_TONE) {
  if (typeof Image === 'undefined' || !deck || warmed.has(`${deck.id}:${tone}`)) return
  warmed.add(`${deck.id}:${tone}`)
  const fam = familyOf(deck)
  const srcs = [deck.backImage, ...['AS', 'QH', 'KS'].map((id) => courtImage(fam, { suit: id[1], value: id[0], id }, { tone }))]
  for (const src of srcs) {
    if (!src) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = src
  }
}
