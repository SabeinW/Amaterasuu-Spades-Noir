-- The AI players remember: every finished game they played (who against,
-- who won, the score), and short notes about each person they've played
-- with, boiled down from the table talk by the `bots` function (how that
-- person talks, running jokes, promises like "we're beating y'all next
-- time"). Server only: nobody reads these from the app.

create table if not exists public.bot_games (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bot_accounts(id) on delete cascade,
  room_id uuid,
  won boolean not null,
  us integer not null,
  them integer not null,
  rounds integer not null,
  -- [{ id, name, side: 'partner' | 'opponent' }] for the people at the table
  people jsonb not null default '[]',
  played_at timestamptz not null default now()
);
create index if not exists bot_games_bot_played on public.bot_games (bot_id, played_at desc);
alter table public.bot_games enable row level security;

create table if not exists public.bot_memories (
  bot_id uuid not null references public.bot_accounts(id) on delete cascade,
  person_id uuid not null references public.profiles(id) on delete cascade,
  notes jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (bot_id, person_id)
);
alter table public.bot_memories enable row level security;

-- Lines of a table's talk not yet boiled into notes.
alter table public.bot_room_talk add column if not exists since_summary integer not null default 0;
