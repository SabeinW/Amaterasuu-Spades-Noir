// How the AI players' answers are read and checked (no network).
//   node scripts/bots/test-talk-parse.mjs
import { aboutText, contextPrompt, memoryText, readReply, readSummary, samey, summaryMessages, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'
import { BOTS, BOT_EMOJI } from '../../supabase/functions/_shared/bots.js'
import { EMOJI_GROUPS } from '../../src/data/taunts.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const say = (id, text) => readReply(id, text).say

eq('plain JSON', readReply('dre', '{"say": "RUN ME MY BOOKS", "emoji": "🔥", "gif": "mic drop"}'), { say: 'RUN ME MY BOOKS', emoji: '🔥', gif: 'mic drop', broke: false })
eq('JSON in a code block', say('jada', '```json\n{"say": "BYE 😂", "emoji": "", "gif": ""}\n```'), 'BYE 😂')
eq('thinking before the JSON', say('nia', '<think>hmm what to say</think>{"say": "aww cute"}'), 'aww cute')
eq('broken JSON still gives the line', say('dre', '{"say: AI player, COMMISSIONER SAID SO", "emoji": "", "gif": ""}'), 'AI player, COMMISSIONER SAID SO')
eq('broken JSON with nothing readable shows nothing', say('dre', '{"emoji": "🔥", oops'), '')
eq('no JSON at all: the text itself', say('malik', 'Predictable.'), 'Predictable.')
eq('own name in front is dropped', say('dre', '{"say": "Big Dre: y\'all done"}'), "y'all done")
eq('long lines are cut', say('jaylen', `{"say": "${'no cap '.repeat(30)}"}`).length <= 110, true)
eq('swearing is dropped', readReply('keisha', '{"say": "damn y\'all bad"}').broke, true)
eq('innuendo is dropped', readReply('keisha', '{"say": "they need a safe word"}').broke, true)
eq('apes never get through', readReply('jaylen', '{"say": "playing like apes"}').broke, true)
eq('an emoji off the list is dropped', readReply('jada', '{"say": "hi", "emoji": "🍺"}').emoji, '')
eq('a GIF search for drinks is dropped', readReply('jada', '{"say": "hi", "gif": "beer pong"}').gif, '')
eq('a GIF search is kept to three words', readReply('jada', '{"gif": "crying laughing so hard right now"}').gif, 'crying laughing so')
eq('"high" is fine (high spades)', readReply('malik', '{"say": "Played my high spade. Predictable."}').broke, false)

const onTable = new Set(EMOJI_GROUPS.flatMap((g) => g.items))
eq('every bot emoji is on the table emoji list', BOT_EMOJI.filter((e) => !onTable.has(e)), [])
for (const [id, b] of Object.entries(BOTS)) {
  eq(`${b.name}'s partner is set up both ways`, BOTS[b.partner].partner, id)
  eq(`${b.name}'s own lines pass the table rules`, b.lines.filter((l) => readReply(id, JSON.stringify({ say: l })).broke), [])
  const sys = systemPrompt(id)
  eq(`${b.name}'s instructions say no Nil and AI if asked`, /never bid Nil/.test(sys) && /AI player/.test(sys), true)
}
const ctx = contextPrompt('nia', 3, { players: [{ seat: 0, name: 'Raheem' }, { seat: 1, name: 'Jaylen' }, { seat: 2, name: 'Wife' }, { seat: 3, name: 'Nia' }], game_state: {} }, [], 'test')
eq('the table is described from her seat', /you are Nia; your partner \(your teammate\) is Jaylen; the other team, the ones to trash talk, is Raheem and Wife/.test(ctx), true)

// Memory
const sum = readSummary('```json\n{"raheem": ["called Dre \\"lil bro\\" 😂", "said damn", "a", "b", "c", "d", "e"], "Wife": ["said they practiced all week"], "Big Dre": ["x"]}\n```', ['Raheem', 'Wife'])
eq('notes are matched to people whatever the case', Object.keys(sum), ['Raheem', 'Wife'])
eq('notes that break the table rules are dropped, five at most', sum.Raheem, ['called Dre "lil bro" 😂', 'a', 'b', 'c', 'd'])
eq('a note about an AI player is ignored', sum['Big Dre'], undefined)
eq('an answer that isn\'t JSON gives nothing', readSummary('sorry, I cannot', ['Raheem']), null)
const mem = memoryText([{ id: 'r', name: 'Raheem', side: 'opponent' }, { id: 'w', name: 'Wife', side: 'partner' }], [{ won: false, us: 380, them: 510, played_at: new Date(Date.now() - 864e5).toISOString(), people: [{ id: 'r', side: 'opponent' }] }], { r: ['called Dre "lil bro"'] })
eq('memory has the record and the last game', /Raheem \(other team\): You've played 1 game against them and won 0\. Last game yesterday you lost 380 to 510\. You remember: called Dre "lil bro"/.test(mem), true)
eq('someone new is a first time', /Wife \(your partner\): First time playing together\./.test(mem), true)
eq('no people, no memory', memoryText([], [], {}), '')
const sm = summaryMessages(['Big Dre', 'Keisha'], [{ name: 'Raheem', notes: ['old note'] }], [{ who: 'Raheem', text: 'hi' }], 'They won.')
eq('the note-taker sees old notes, the talk and how it went', /old note/.test(sm[1].content) && /Raheem: hi/.test(sm[1].content) && /They won/.test(sm[1].content), true)
eq('the note-taker is told not to make things up', /Never make anything up/.test(sm[0].content), true)

// The score, spelled out from the bot's side
const losing = contextPrompt('jaylen', 3, { players: [{ seat: 0, name: 'Raheem' }, { seat: 1, name: 'Nia' }, { seat: 2, name: 'Wife' }, { seat: 3, name: 'Jaylen' }], game_state: { scores: { A: { total: 133, bags: 3 }, B: { total: 12, bags: 2 } }, round: 3, rules: { winScore: 500 } } }, [], 'x')
eq('a bot that is behind is told it is LOSING, by how much', /you and Nia have 12 points .*Raheem and Wife have 133 points .*Your team is LOSING by 121/.test(losing), true)
const winning = contextPrompt('nia', 1, { players: [{ seat: 0, name: 'Raheem' }, { seat: 1, name: 'Nia' }, { seat: 2, name: 'Wife' }, { seat: 3, name: 'Jaylen' }], game_state: { scores: { A: { total: 40, bags: 0 }, B: { total: 90, bags: 1 } }, round: 2, rules: { winScore: 500 } } }, [{ who: 'Nia', text: 'aww cute' }], 'x')
eq('a bot that is ahead is told it is WINNING', /Your team is WINNING by 50/.test(winning), true)
eq('its own lines are marked', /Nia \(you\): aww cute/.test(winning), true)
eq('a line starting like its last one is caught', samey('nia', 'aww, still saying that?', [{ who: 'Nia', text: 'aww, still laughing?' }]), true)
eq('…but not someone else\'s', samey('nia', 'aww, still saying that?', [{ who: 'Jaylen', text: 'aww, still laughing?' }]), false)

// Who's who
const couple = aboutText([{ id: 's', name: 'Sabe' }, { id: 't', name: 'Swizz' }, { id: 'm', name: 'Mom' }], { s: { pronouns: 'he', spouse_id: 't' }, t: { pronouns: 'she', spouse_id: 's' } })
eq('pronouns are spelled out', /Sabe is a man \(he\/him\)\. Swizz is a woman \(she\/her\)\./.test(couple), true)
eq('the couple is married, wife and husband', /Swizz is Sabe's wife, Sabe is Swizz's husband/.test(couple), true)
eq('pet names between them are for each other', /baby, bae, babe or my love, they mean each other, never you/.test(couple), true)
eq('anyone else is called by name, never guessed', /You don't know whether Mom is a he or a she: call them by name, never guess/.test(couple), true)
eq('no facts: still told not to guess', /call them by name, never guess/.test(aboutText([{ id: 'x', name: 'X' }], {})), true)
eq('who\'s who goes right after who\'s at the table', /the ones to trash talk, is .*\n\nWho's who: Sabe is a man/.test(contextPrompt('nia', 1, { players: [{ seat: 0, name: 'Sabe' }, { seat: 2, name: 'Swizz' }], game_state: {} }, [], 'x', '', couple)), true)
eq('the rules say never guess man or woman', /Never guess whether someone is a man or a woman/.test(systemPrompt('jaylen')), true)

eq('they talk in the first person', /Always talk in the first person/.test(systemPrompt('malik')) && /Never say your own name \("Malik"\)/.test(systemPrompt('malik')), true)
eq('their partner is on their side', /Jada is your partner and on your side: hype Jada up/.test(systemPrompt('malik')), true)
eq('a repeat without the apostrophe is caught', samey('jada', "Malik didn't leash me he signed up to WIN, something y'all wouldn't know about", [{ who: 'Jada', text: 'malik didnt sign up to leash me he signed up to WIN, something yall wouldnt know about' }]), true)

console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
