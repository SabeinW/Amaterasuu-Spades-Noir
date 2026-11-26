// Prints the Qalam prompts for every deck back and table, built from the
// theme data itself (src/data/tableThemes.js) so art and descriptions agree.
//   node scripts/art/prompts.mjs backs|tables > items.json
import { ALL_DECKS, ALL_TABLES } from '../../src/data/tableThemes.js'

const kind = process.argv[2] ?? 'backs'
const NO_TEXT = 'Straight-on, flat, no perspective, no shadow, no text, no letters, no numbers, no logos, no playing-card suit symbols unless described.'

const backPrompt = (d) =>
  `Flat, full-bleed playing-card back design, perfectly symmetric and mirrored top-to-bottom: ${d.art}. ` +
  `A thin double border in a matching metal tone (gold, silver or the motif's accent colour) inset from the edge, with small rounded corners, and a calm margin so the design survives trimming to a 5:7 card. ` +
  `Elegant Japanese lacquerware craft, premium and restrained, crisp fine line work. ${NO_TEXT}`

const tablePrompt = (t) =>
  `Top-down view of an empty card-table surface, seen straight from above: ${t.art}. ` +
  `Even, soft lighting with a gentle pool of warm light in the middle fading to a darker vignette at the edges; ` +
  `any pattern or detail stays near the edges so the calm centre is clear for laying playing cards. ` +
  `Rich material texture, premium and minimal. No objects, no cards, no room, no reflections of windows or lamps, no text, no letters.`

const items =
  kind === 'tables'
    ? ALL_TABLES.map((t) => ({ name: t.id, model: 'gpt-image-2.6', settings: { aspectRatio: '1:1', quality: 'high' }, prompt: tablePrompt(t) }))
    : ALL_DECKS.filter((d) => d.id !== 'sun-ink' && d.family !== 'mythic').map((d) => ({
        name: d.id,
        model: 'gpt-image-2.6',
        settings: { aspectRatio: '3:4', quality: 'high' },
        references: ['/home/raheemlinuxmaster/spades-art/style-round/back_sun.png'],
        prompt: backPrompt(d) + ' Match the craft quality of the reference card back, but use the colours and motif described here, not the reference\'s.',
      }))
console.log(JSON.stringify(items, null, 1))
