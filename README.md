# Amaterasuu Noir Spades

Spades for friends and family — online tables, AI partners, and 38 painted
decks — in a "sun & ink lacquer" look (black lacquer, gold leaf, vermilion,
washi-paper cards). React 19 + Vite + Tailwind 4 + `motion`, Supabase for
accounts, rooms and realtime.

## How online play works

The server runs every online match; no player's browser is "the host".

```
browser ──act(move)──▶ edge function `game` ──commit_room()──▶ rooms (public state, no cards)
   ▲                         │  shared rules engine            room_secrets (hands, server-only)
   │                         └─ bots / timed-out seats move here
   └── realtime UPDATE on rooms + get_my_hand() for your own cards
```

- **One rules engine** — `supabase/functions/_shared/engine.js` — deals,
  validates bids and plays, scores, and plays bots. The edge function and
  practice games (`src/game/useLocalGame.js`) both run it.
- **Hidden hands** — cards live in `room_secrets`, which clients cannot read;
  `get_my_hand(room)` returns only your seat's cards.
- **No freezes** — a human turn has a deadline (40 s to bid, 30 s to play;
  the "Turn timer" house rule). After it passes, any player's client sends
  `nudge` and the server moves for the idle seat. Players who leave mid-match
  keep their seat (a bot covers it) and can rejoin with the code.
- **No races** — every write is read → apply → `commit_room(version)`; a
  conflicting write retries against the fresh state.
- **Animation** — each change appends numbered events (`deal`, `bid`,
  `play`, `trick`, `round`, `game`). `src/game/useEventPlayer.js` plays them
  one at a time (cards fly from the dealer, into the trick, then sweep to the
  winner) and then settles on the server's snapshot.

## Local development

```bash
npm install
npx supabase start            # Docker; applies supabase/migrations
npx supabase functions serve  # serves supabase/functions/game
```

Put the local URL and anon key from `npx supabase status` in `.env.local`
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), then `npm run dev`.

## Tests

```bash
node scripts/test-engine.mjs     # 900 bot matches across rule variants + validation
node scripts/test-online.mjs     # 4 accounts play a full match through the server
node scripts/test-timeout.mjs    # a silent player is auto-played after the deadline
node scripts/ui-practice.mjs     # browser: a practice round, screenshots
node scripts/ui-online.mjs       # browser: host + guest play two rounds online
```

## Deploying

1. Apply `supabase/migrations/20261126000000_server_authoritative_game.sql` to
   the live project (the baseline migration describes tables that already exist).
2. Deploy the function: `npx supabase functions deploy game --project-ref essvhymfgxlmoedqdjpz`.
3. Push the branch — Vercel builds previews for branches and production from `main`.
4. `vercel.json` runs `api/keep-alive.js` once a day (production only) so the
   free Supabase project never pauses for inactivity.

## Art and sound

- All art was painted in Qalam (GPT Image 2.6 / Kling 4.0 Frames):
  `public/art/{backs,court,tables,avatars,hero}`. Prompts are generated from the
  theme data by `scripts/art/prompts.mjs`.
- Sound is real recorded foley only (no music, no bells): `public/sounds`, with
  sources and licences in `public/sounds/SOURCES.md`.
