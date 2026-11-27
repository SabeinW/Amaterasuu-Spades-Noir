// Tables and decks — the Sun & Ink lacquer revamp (Nov 2026).
//
// Every theme keeps its old `id` so a player's saved choice still resolves,
// but each one now has its own painted art made in Qalam:
//   tables → /art/tables/<id>.webp   (top-down surface, cover-fitted)
//   decks  → /art/backs/<id>.webp    (card back), faces drawn in CSS with the
//            illustrated court cards from /art/court/<washi|noir>/<card>.webp
// The `art` text on each entry is the prompt motif it was painted from (see
// scripts/art/prompts.mjs), so the picker description and the art agree.

// ── Custom uploaded tables (unchanged behaviour) ───────────────────────────
const TABLE_IMAGE_MAX_EDGE = 900
const TABLE_IMAGE_QUALITY = 0.78
const MAX_TABLE_IMAGE_BYTES = 550_000
const MAX_TABLE_GIF_BYTES = 1_200_000
export const MAX_CUSTOM_TABLES = 4

export function fileToTableBackgroundDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image or GIF file.'))
      return
    }
    if (file.type === 'image/gif') {
      if (file.size > MAX_TABLE_GIF_BYTES) {
        reject(new Error('That GIF is too large — try one under 1.2MB.'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error("Couldn't read that GIF."))
      reader.readAsDataURL(file)
      return
    }
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, TABLE_IMAGE_MAX_EDGE / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', TABLE_IMAGE_QUALITY)
      if (dataUrl.length > MAX_TABLE_IMAGE_BYTES) {
        reject(new Error('That image is too large — try a different one.'))
        return
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Couldn't read that image."))
    }
    img.src = objectUrl
  })
}

export function customTableTheme(imageDataUrl, id = `custom-${Date.now()}`, name = 'Your Custom Table') {
  return {
    id,
    name,
    tag: 'CUSTOM',
    description: 'Your own uploaded image or GIF',
    image: imageDataUrl,
    base: '#0b0a08',
    accentColor: '#d4a64a',
    custom: true,
    imageDataUrl,
  }
}

// ── Tables ─────────────────────────────────────────────────────────────────
const table = (id, name, tag, base, accentColor, art, description) => ({
  id,
  name,
  tag,
  base,
  accentColor,
  art,
  description,
  image: `/art/tables/${id}.webp`,
  thumb: `/art/tables/thumb/${id}.webp`,
})

export const TABLE_THEMES = [
  table('sun-lacquer', 'Sun Lacquer', 'Signature', '#0b0a08', '#d4a64a',
    'glossy black urushi lacquer with a faint hammered gold-leaf sun disc at the center and very thin gold rays, sparse gold-dust flecks',
    'Black lacquer with a gold-leaf sun'),
  table('classic-felt', 'Pine Felt', 'Classic', '#0f2a20', '#5f9e7d',
    'deep forest-green wool felt with fine gold pine-needle embroidery around the outer edge',
    'Green felt stitched with gold pine'),
  table('midnight-velvet', 'Midnight Velvet', null, '#1d0f2e', '#a78bfa',
    'deep purple crushed velvet with faint silver wisteria sprays near the edges',
    'Purple velvet, silver wisteria'),
  table('deep-space', 'Ink Night Sky', null, '#070b16', '#7aa2e3',
    'sumi-e ink-wash night sky in deep blue-black with gold-dust stars and a soft milky band of mist',
    'Ink-wash night with gold-dust stars'),
  table('frosted-glass', 'Frosted Silver', null, '#22262b', '#cfd6dd',
    'frosted silver-grey lacquer with snow-like silver flecks and a soft cool glow in the center',
    'Silver-grey lacquer, frost flecks'),
  table('royal-crimson', 'Royal Crimson', 'Premium', '#3a0d0a', '#e0442e',
    'rich vermilion-red lacquer with a faint gold sun disc at the center and a thin gold band at the edges',
    'Vermilion lacquer with a gold sun'),
  table('cyber-neon', 'Neon Raden', 'Premium', '#09080c', '#ec4899',
    'black lacquer with hot-pink and cyan mother-of-pearl (raden) inlay lines sweeping around the edges',
    'Pink & cyan mother-of-pearl inlay'),
]

export const MASTER_THEMES = [
  table('obsidian-gold', 'Obsidian Gold', 'LUXE', '#0a0806', '#d4a64a',
    'polished black obsidian with a heavy hammered gold-leaf band framing the edges',
    'Black obsidian, heavy gold leaf'),
  table('royal-crimson-m', 'Crimson Silk', 'ROYAL', '#2a0607', '#e0442e',
    'deep crimson silk brocade with a subtle antique-silver cloud pattern',
    'Crimson silk with silver clouds'),
  table('cyber-neon-m', 'Neon Rain', 'NEON', '#06060a', '#22d3ee',
    'rain-wet black lacquer with soft abstract streaks of pink and cyan light reflected in it',
    'Rain-wet lacquer, neon streaks'),
  table('classic-emerald', 'Emerald Lacquer', 'CLASSIC', '#062018', '#34d399',
    'deep emerald-green lacquer with gold cloud scrolls in the corners',
    'Emerald lacquer, gold clouds'),
  table('arctic-frost-m', 'Arctic Frost', 'FROST', '#0b1d2b', '#7dd3fc',
    'icy blue lacquer with delicate silver frost-crystal patterns spreading from the edges',
    'Ice-blue lacquer, frost crystals'),
  table('midnight-amethyst-m', 'Midnight Amethyst', 'DARK', '#170b2a', '#a78bfa',
    'violet-indigo lacquer with fine silver star dust',
    'Violet lacquer, silver star dust'),
  table('inferno-amber', 'Kintsugi Ember', 'FIRE', '#140703', '#f97316',
    'cracked black lacquer repaired with glowing amber-gold kintsugi seams running across the surface',
    'Black lacquer, glowing gold seams'),
  table('midnight-galaxy', 'Midnight Galaxy', 'GALAXY', '#05060f', '#818cf8',
    'matte black lacquer with a faint iridescent violet-and-teal galaxy haze and tiny gold stars',
    'Matte black, iridescent haze'),
]

// ── Decks ──────────────────────────────────────────────────────────────────
// face: card stock ('washi' warm paper | 'ivory' bright paper | 'noir' black lacquer)
// ink:  suit colours; court: which illustrated court set the face uses.
export const INK = {
  sumi: '#1a1714',
  verm: '#c8321f',
  ochre: '#a8741a',
  jade: '#2c7a55',
  silver: '#efe6d6',
}
const fourColour = { S: INK.sumi, H: INK.verm, D: INK.ochre, C: INK.jade }
const twoColour = { S: INK.sumi, H: INK.verm, D: INK.verm, C: INK.sumi }

// Which card family (court art, emblem, effect) each deck uses — see
// cardFamilies.js. Every family's court is Black royals by default.
const STYLE_BY_ID = {
  'sun-ink': 'sun', 'noir-classic': 'sun', 'crimson-royale': 'ember', 'arctic-frost': 'frost',
  'emerald-casino': 'jade', 'obsidian-gold': 'eclipse', 'cyber-neon': 'storm', 'royal-sapphire': 'tide',
  'midnight-amethyst': 'moon', 'inferno-amber': 'ember', 'rose-quartz': 'bloom', 'platinum-silver': 'moon',
  'jade-imperial': 'jade', 'galaxy-holo': 'starfall',
  'inferno-blaze-m': 'ember', 'glacier-frost-m': 'frost', 'onyx-sovereign-m': 'eclipse', 'venom-toxic-m': 'jade',
  'imperial-amethyst-m': 'aurora', 'blood-moon-m': 'moon', 'solar-flare-m': 'dune', 'abyssal-tide-m': 'tide',
  'rose-gold-elite-m': 'bloom', 'shadow-viper-m': 'storm',
  'midnight-sapphire': 'tide', 'midnight-orchid': 'aurora', 'midnight-jade': 'jade', 'midnight-gold': 'sun',
  'midnight-cyan': 'tide', 'midnight-rose': 'bloom', 'midnight-ember': 'ember', 'midnight-teal': 'aurora',
  'midnight-platinum': 'frost',
}

const deck = (id, name, tag, family, opts) => ({
  id,
  name,
  tag,
  family,
  face: opts.face ?? 'washi',
  ink: opts.ink ?? fourColour,
  edge: opts.edge ?? '#d4a64a',
  court: opts.court ?? ((opts.face ?? 'washi') === 'noir' ? 'noir' : 'washi'),
  pill: opts.pill, // optional: { bg, ink } label behind the rank on painted cards
  style: opts.style ?? STYLE_BY_ID[id] ?? (family === 'og' ? 'classic' : 'sun'),
  backTint: opts.backTint ?? '#0b0a08',
  art: opts.art,
  description: opts.description,
  backImage: `/art/backs/${id}.webp`,
  // Legacy shape some older components still read.
  back: { from: opts.backTint ?? '#0b0a08', to: '#050403', border: opts.edge ?? '#d4a64a' },
})

const noirInk = (accent) => ({ S: INK.silver, C: INK.silver, H: accent, D: accent })
const paperMetalInk = (metal) => ({ S: INK.sumi, C: INK.sumi, H: metal, D: metal })

export const DECK_THEMES = [
  deck('sun-ink', 'Sun & Ink', 'Signature', 'standard', {
    ink: twoColour, backTint: '#0b0a08',
    art: 'a hammered gold-leaf sun disc at the center with fine radiating rays on glossy black lacquer, bands of gold seigaiha waves top and bottom, a tiny vermilion dot at the sun\'s center',
    description: 'Gold-leaf sun on black lacquer, washi faces',
  }),
  deck('noir-classic', 'Noir Classic', null, 'standard', {
    backTint: '#0b0a08',
    art: 'a fine gold asanoha (hemp-leaf) geometric lattice over glossy black lacquer with a small vermilion sun disc at the center',
    description: 'Gold hemp-leaf lattice on black',
  }),
  deck('crimson-royale', 'Crimson Royale', null, 'standard', {
    backTint: '#8f1d12', edge: '#e0442e',
    art: 'vermilion-red lacquer with ornate gold filigree scrollwork and stylised camellia blossoms',
    description: 'Vermilion lacquer, gold filigree',
  }),
  deck('arctic-frost', 'Arctic Frost', null, 'standard', {
    backTint: '#1b2a4a', edge: '#9cc7f0',
    art: 'deep indigo lacquer with silver snowflake-ring crests (yukiwa) and fine silver wave lines',
    description: 'Indigo lacquer, silver snow crests',
  }),
  deck('emerald-casino', 'Emerald Pine', null, 'standard', {
    backTint: '#0f3a29', edge: '#5f9e7d',
    art: 'deep green lacquer with a symmetric gold pine-branch pattern',
    description: 'Green lacquer, gold pine branches',
  }),
  deck('obsidian-gold', 'Obsidian Gold', null, 'standard', {
    backTint: '#0a0806',
    art: 'polished black obsidian lacquer with a heavy hammered gold-leaf frame and a central gold crest of interlocking circles (shippo)',
    description: 'Black obsidian, heavy gold crest',
  }),
  deck('cyber-neon', 'Neon Raden', null, 'standard', {
    backTint: '#120914', edge: '#ec4899',
    art: 'black lacquer with iridescent hot-pink and cyan mother-of-pearl (raden) inlay in a symmetric wave pattern',
    description: 'Pink & cyan mother-of-pearl inlay',
  }),
  deck('royal-sapphire', 'Royal Sapphire', null, 'standard', {
    backTint: '#13245c', edge: '#93c5fd',
    art: 'sapphire-blue lacquer with gold seigaiha waves covering the field',
    description: 'Sapphire lacquer, gold waves',
  }),
  deck('midnight-amethyst', 'Midnight Amethyst', null, 'standard', {
    backTint: '#2a1450', edge: '#c4b5fd',
    art: 'violet-indigo lacquer with cascading silver wisteria sprays mirrored top and bottom',
    description: 'Violet lacquer, silver wisteria',
  }),
  deck('inferno-amber', 'Inferno Amber', null, 'standard', {
    backTint: '#3a1405', edge: '#fb923c',
    art: 'black lacquer with drifting orange ember flecks and gold flame scrolls rising from the bottom and mirrored at the top',
    description: 'Embers and gold flame scrolls',
  }),
  deck('rose-quartz', 'Rose Quartz', null, 'standard', {
    backTint: '#5a2238', edge: '#f9a8d4',
    art: 'blush-pink lacquer with rose-gold cherry blossoms and fine rose-gold lines',
    description: 'Blush lacquer, rose-gold blossoms',
  }),
  deck('platinum-silver', 'Platinum Silver', null, 'standard', {
    backTint: '#3b4048', edge: '#e2e8f0',
    art: 'brushed silver-grey lacquer with a fine platinum kumiko woodwork lattice',
    description: 'Silver lacquer, kumiko lattice',
  }),
  deck('jade-imperial', 'Jade Imperial', null, 'standard', {
    backTint: '#0c3b35', edge: '#facc15',
    art: 'imperial jade-green lacquer with gold auspicious cloud scrolls',
    description: 'Jade lacquer, gold cloud scrolls',
  }),
  deck('galaxy-holo', 'Galaxy Holo', null, 'standard', {
    backTint: '#14123a', edge: '#a5b4fc',
    art: 'deep indigo-black lacquer with a field of gold-dust stars and a silver crescent moon at the center',
    description: 'Gold-dust stars and a silver moon',
  }),
]

// Mythic Courts — the showcase class: each deck has its own family of
// illustrated Black royals, its own back, and the strongest living effects.
// Each also has its own lettering: `ink` colours the rank and suit on the
// paper of the number cards; `pill` is the label behind the rank on the
// painted cards (a dark lacquer label with light letters, or a pale one with
// deep letters), so every deck's K, Q, J and A carry its own colours.
// As on the Master decks, spades and clubs stay neutral (near-black or
// near-white) and hearts and diamonds take the deck's colour, so trumps are
// still easy to spot.
const look = (paperSC, paperHD, pillBg, pillSC, pillHD) => ({
  ink: { S: paperSC, C: paperSC, H: paperHD, D: paperHD },
  pill: { bg: pillBg, ink: { S: pillSC, C: pillSC, H: pillHD, D: pillHD } },
})
const mythic = (id, name, tag, style, backTint, edge, description, lettering) =>
  deck(id, name, tag, 'mythic', { style, backTint, edge, ...lettering, description })

export const MYTHIC_DECK_THEMES = [
  mythic('sun-court', 'Sun Court', 'SOLAR', 'sun', '#0b0a08', '#d4a64a', 'Gold-leaf sun royals with a breathing golden glow',
    look('#1a1714', '#c8321f', '#0b0a08', '#f1d28a', '#f04a3a')),
  mythic('mythic-moon', 'Lunar Veil', 'LUNAR', 'moon', '#141b34', '#aab6d3', 'Moonlit royals in indigo and pearl; stars twinkle',
    look('#151a30', '#3f5fd0', '#1b2448', '#eef1fb', '#7f9cff')),
  mythic('mythic-ember', 'Ember Crown', 'FIRE', 'ember', '#2a0a02', '#e0743a', 'Fire-forged royals; embers glow and sparks rise',
    look('#1f0d06', '#c2410c', '#2a0a02', '#f6ecdf', '#ff6a2e')),
  mythic('mythic-tide', 'Tidecaller', 'WATER', 'tide', '#062033', '#3f9fc4', 'Sea royals among waves and koi; light ripples',
    look('#0c1c26', '#0a7fa8', '#062033', '#eef8fb', '#38d0f5')),
  mythic('mythic-frost', 'Frostborne', 'ICE', 'frost', '#16283a', '#9cc9e4', 'Winter royals in white and ice; frost glints',
    look('#131c26', '#1f78c0', '#16283a', '#f2f9ff', '#38bdf8')),
  mythic('mythic-jade', 'Jade Grove', 'FOREST', 'jade', '#0c2a1c', '#4f9a6c', 'Forest royals among bamboo and pine',
    look('#0f1f16', '#23864f', '#0c2a1c', '#eef7ef', '#4ade80')),
  mythic('mythic-bloom', 'Sakura Bloom', 'BLOSSOM', 'bloom', '#3a1a26', '#d98aa2', 'Blossom royals; petals drift across the cards',
    look('#1f1418', '#c8326a', '#fdf0f3', '#1f1418', '#c8326a')),
  mythic('mythic-storm', 'Stormcaller', 'THUNDER', 'storm', '#160f2e', '#8b7bf0', 'Storm royals; lightning flashes on the cards',
    look('#16122a', '#6d4ff0', '#160f2e', '#ece8ff', '#ffd54a')),
  mythic('mythic-eclipse', 'Eclipse', 'SHADOW', 'eclipse', '#050403', '#c9962e', 'Black-and-gold royals under a pulsing corona',
    look('#14100a', '#a8320e', 'linear-gradient(135deg,#f6dc9a,#c9962e)', '#120d05', '#7a1a0c')),
  mythic('mythic-aurora', 'Aurora', 'LIGHTS', 'aurora', '#071a26', '#3fb8a8', 'Northern-lights royals; curtains of light shift',
    look('#0b1e24', '#b8338e', '#071a26', '#eefbf8', '#ff86d8')),
  mythic('mythic-starfall', 'Starfall', 'COSMIC', 'starfall', '#0a0c26', '#c9a24d', 'Cosmic royals; shooting stars cross the cards',
    look('#12142a', '#7a3cc0', '#0a0c26', '#f4f2ff', '#f3c65c')),
  mythic('mythic-dune', 'Dune Kingdom', 'DESERT', 'dune', '#3a1e08', '#c98a3a', 'Desert royals in saffron and teal; sand drifts',
    look('#2a1606', '#0e7c78', '#fbefd9', '#2a1606', '#0e7c78')),
  mythic('mythic-cloudborn', 'Cloudborn', 'SKY', 'cloudborn', '#2a1650', '#a98bff', 'Joyful white-haired royals in purple and white; clouds burst and lightning cracks',
    look('#1c1233', '#2858e8', '#2a1650', '#ffffff', '#6f9bff')),
]

// Concrete Crowns — modern streetwear royals (Tokyo and uptown US).
const street = (id, name, tag, style, backTint, edge, description) =>
  deck(id, name, tag, 'street', { style, backTint, edge, ink: { S: INK.sumi, H: INK.verm, D: INK.verm, C: INK.sumi }, description })

export const STREET_DECK_THEMES = [
  street('street-shibuya', 'Shibuya Drip', 'TOKYO', 'shibuya', '#0c0a14', '#e0409a', 'Tokyo streetwear royals; neon hums and rain falls'),
  street('street-uptown', 'Uptown Royalty', 'UPTOWN', 'uptown', '#3a1214', '#c98a5a', 'Uptown streetwear royals in golden-hour light; paint specks drift'),
]

// Capes & Chaos — original heroes and villains (no existing comic characters).
const capes = (id, name, tag, style, backTint, edge, description) =>
  deck(id, name, tag, 'capes', { style, backTint, edge, ink: { S: INK.sumi, H: INK.verm, D: INK.verm, C: INK.sumi }, description })

export const CAPES_DECK_THEMES = [
  capes('capes-heroes', 'Hero League', 'HEROES', 'heroes', '#0b1a4a', '#4f86ff', 'Original heroes; action bursts flare across the cards'),
  capes('capes-villains', 'Rogue Syndicate', 'VILLAINS', 'villains', '#140406', '#d0283f', 'Original villains; crimson pulses and dark smoke rises'),
  // A personal deck made for the family: royal purple with violet K/Q/J labels.
  deck('capes-violet', 'Total Carnage', 'CARNAGE', 'capes', {
    style: 'violet', backTint: '#1a0a33', edge: '#b07cff', description: 'Purple heroes and villains; violet power surges',
    ...look('#1a1430', '#7b2fd6', '#1a0a33', '#f4eeff', '#c79bff'),
  }),
]

// Anime Nights — original anime-style casts (no existing characters,
// costumes or logos). Laughing Moon: a gothic academy under a grinning moon.
const anime = (id, name, tag, style, backTint, edge, description) =>
  deck(id, name, tag, 'anime', { style, backTint, edge, ink: { S: INK.sumi, H: INK.verm, D: INK.verm, C: INK.sumi }, description })

export const ANIME_DECK_THEMES = [
  anime('anime-laughing-moon', 'Laughing Moon', 'GRIN', 'laughmoon', '#120a22', '#a48cf0', 'Gothic academy fighters under a laughing moon'),
]

export const MASTER_DECK_THEMES = [
  deck('inferno-blaze-m', 'Inferno Blaze', 'FIRE', 'master', {
    face: 'noir', ink: noirInk('#f97316'), edge: '#f97316', backTint: '#2a0a02',
    art: 'molten orange-gold flame waves rolling across black lacquer, mirrored top and bottom',
    description: 'Black stock, molten orange-gold',
  }),
  deck('glacier-frost-m', 'Glacier Frost', 'FROST', 'master', {
    face: 'ivory', ink: paperMetalInk('#0e7fb8'), edge: '#38bdf8', backTint: '#0c2a3a',
    art: 'pale ice-blue lacquer with silver frost crystals spreading from the center',
    description: 'Bright stock, polished ice-blue',
  }),
  deck('onyx-sovereign-m', 'Onyx Sovereign', 'LUXE', 'master', {
    face: 'noir', ink: noirInk('#e8c066'), edge: '#d4a64a', backTint: '#050403',
    art: 'polished black onyx with a heavy 24k gold-leaf border and a large ornate gold medallion at the center',
    description: 'Black onyx, heavy 24k gold',
  }),
  deck('venom-toxic-m', 'Venom Toxic', 'TOXIC', 'master', {
    face: 'noir', ink: noirInk('#a3e635'), edge: '#84cc16', backTint: '#0a1400',
    art: 'black lacquer with acid-green scale-pattern (uroko triangles) glowing softly',
    description: 'Black stock, acid-green scales',
  }),
  deck('imperial-amethyst-m', 'Imperial Amethyst', 'ROYAL', 'master', {
    face: 'ivory', ink: paperMetalInk('#7e22ce'), edge: '#a855f7', backTint: '#2a0c44',
    art: 'deep royal-purple lacquer with gold paulownia-leaf crests in a symmetric arrangement',
    description: 'Bright stock, royal purple and gold',
  }),
  deck('blood-moon-m', 'Blood Moon', 'CRIMSON', 'master', {
    face: 'noir', ink: noirInk('#ef4444'), edge: '#ef4444', backTint: '#1a0202',
    art: 'black lacquer with a large crimson moon disc at the center veiled by thin silver cloud wisps',
    description: 'Black stock, crimson moon',
  }),
  deck('solar-flare-m', 'Solar Flare', 'SOLAR', 'master', {
    face: 'ivory', ink: paperMetalInk('#c2410c'), edge: '#f59e0b', backTint: '#3a2200',
    art: 'a radiant amber-gold sun bursting outward across a black-to-amber lacquer gradient',
    description: 'Bright stock, amber-gold sunburst',
  }),
  deck('abyssal-tide-m', 'Abyssal Tide', 'OCEAN', 'master', {
    face: 'noir', ink: noirInk('#22d3ee'), edge: '#22d3ee', backTint: '#021018',
    art: 'deep-sea black lacquer with curling bioluminescent cyan wave crests',
    description: 'Black stock, bioluminescent waves',
  }),
  deck('rose-gold-elite-m', 'Rose Gold Elite', 'ELITE', 'master', {
    face: 'ivory', ink: paperMetalInk('#be5a6a'), edge: '#e0a899', backTint: '#3a1520',
    art: 'satin blush lacquer with overlapping rose-gold folding-fan (ogi) shapes',
    description: 'Bright stock, rose-gold fans',
  }),
  deck('shadow-viper-m', 'Shadow Viper', 'STEALTH', 'master', {
    face: 'noir', ink: noirInk('#4ade80'), edge: '#4ade80', backTint: '#07120a',
    art: 'graphite lacquer with dark green bamboo stalks and leaves in shadow, edged in venom-green light',
    description: 'Graphite stock, green bamboo shadows',
  }),
]

export const OG_DECK_THEMES = [
  deck('og-vegas-white', 'Vegas White', 'VEGAS', 'og', {
    face: 'ivory', ink: twoColour, edge: '#d4a64a', backTint: '#6e1610',
    art: 'deep red lacquer with a classic symmetric gold filigree playing-card pattern and gold border',
    description: 'Classic red-and-gold back, white faces',
  }),
  deck('og-casino-black', 'Casino Black', 'CLASSIC', 'og', {
    face: 'noir', ink: { S: INK.silver, C: INK.silver, H: '#ef4444', D: '#ef4444' }, edge: '#93c5fd', backTint: '#0f1e4a',
    art: 'sapphire-navy lacquer with a classic fine silver lattice playing-card pattern',
    description: 'Navy-and-silver back, black faces',
  }),
  deck('og-parlor-ivory', 'Parlor Ivory', 'PARLOR', 'og', {
    face: 'washi', ink: twoColour, edge: '#d4a64a', backTint: '#123d22',
    art: 'forest-green lacquer with a classic gold lattice playing-card pattern',
    description: 'Forest-green back, ivory faces',
  }),
  deck('og-midnight-noir', 'Midnight Noir', 'NOIR', 'og', {
    face: 'noir', ink: { S: INK.silver, C: INK.silver, H: '#ef4444', D: '#ef4444' }, edge: '#e2e8f0', backTint: '#18181b',
    art: 'graphite lacquer with a classic silver lattice playing-card pattern',
    description: 'Graphite-and-silver back, black faces',
  }),
  deck('og-royal-burgundy', 'Royal Burgundy', 'ROYAL', 'og', {
    face: 'ivory', ink: twoColour, edge: '#d4a64a', backTint: '#5a0f2c',
    art: 'burgundy lacquer with ornate gold damask and a gold border',
    description: 'Burgundy damask back, white faces',
  }),
  deck('og-ace-gold', 'Ace Gold', 'GOLD', 'og', {
    face: 'noir', ink: { S: '#f1d28a', C: '#f1d28a', H: '#ef4444', D: '#ef4444' }, edge: '#f1d28a', backTint: '#1c1305',
    art: 'antique gold ornament on black lacquer, an ornate symmetric gold frame with a gold spade-shaped crest at the center',
    description: 'Antique gold on black',
  }),
]

const midnight = (id, name, tag, accent, motif) =>
  deck(id, name, tag, 'midnight', {
    face: 'noir', ink: noirInk(accent), edge: accent, backTint: '#09090b',
    art: `black lacquer with a fine ${motif} drawn in thin glowing lines`,
    description: `Black stock, ${name.replace('Midnight ', '').toLowerCase()} ink`,
  })

export const MIDNIGHT_DECK_THEMES = [
  midnight('midnight-sapphire', 'Midnight Sapphire', 'BLUE', '#3b82f6', 'sapphire-blue seigaiha wave pattern'),
  midnight('midnight-orchid', 'Midnight Orchid', 'PURPLE', '#a855f7', 'orchid-purple wisteria pattern'),
  midnight('midnight-jade', 'Midnight Jade', 'GREEN', '#22c55e', 'jade-green bamboo pattern'),
  midnight('midnight-gold', 'Midnight Gold', 'GOLD', '#f5c84a', 'gold asanoha hemp-leaf pattern'),
  midnight('midnight-cyan', 'Midnight Cyan', 'CYAN', '#22d3ee', 'electric-cyan flowing water pattern'),
  midnight('midnight-rose', 'Midnight Rose', 'ROSE', '#ec4899', 'hot-rose cherry-blossom pattern'),
  midnight('midnight-ember', 'Midnight Ember', 'AMBER', '#f97316', 'ember-orange flame pattern'),
  midnight('midnight-teal', 'Midnight Teal', 'TEAL', '#14b8a6', 'deep-teal pine-needle pattern'),
  midnight('midnight-platinum', 'Midnight Platinum', 'PLATINUM', '#cbd5e1', 'platinum kumiko lattice pattern'),
]

export const ALL_DECKS = [...MYTHIC_DECK_THEMES, ...STREET_DECK_THEMES, ...CAPES_DECK_THEMES, ...ANIME_DECK_THEMES, ...DECK_THEMES, ...MASTER_DECK_THEMES, ...OG_DECK_THEMES, ...MIDNIGHT_DECK_THEMES]
export const DEFAULT_DECK = MYTHIC_DECK_THEMES[0]
export const ALL_TABLES = [...TABLE_THEMES, ...MASTER_THEMES]
export const DECK_FAMILIES = [
  { id: 'mythic', label: 'Mythic Courts', decks: MYTHIC_DECK_THEMES },
  { id: 'street', label: 'Concrete Crowns', decks: STREET_DECK_THEMES },
  { id: 'capes', label: 'Capes & Chaos', decks: CAPES_DECK_THEMES },
  { id: 'anime', label: 'Anime Nights', decks: ANIME_DECK_THEMES },
  { id: 'standard', label: 'Lacquer', decks: DECK_THEMES },
  { id: 'master', label: 'Master', decks: MASTER_DECK_THEMES },
  { id: 'og', label: "OG's", decks: OG_DECK_THEMES },
  { id: 'midnight', label: 'Midnight', decks: MIDNIGHT_DECK_THEMES },
]
