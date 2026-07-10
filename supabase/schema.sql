-- Amaterasuu Noir Spades — reference copy of the LIVE schema already
-- running on the connected Supabase project (essvhymfgxlmoedqdjpz).
--
-- This file is documentation, not a migration to run — the tables,
-- indexes, RLS policies, and realtime publication described here
-- already exist in that project with real data in them. It's kept
-- here so a fresh environment (or a teammate) can see the contract
-- this app's lib/rooms.js and lib/auth.js code against, and to make
-- it possible to stand up a from-scratch project with the same shape
-- if ever needed.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  games_played integer default 0,
  wins integer default 0,
  losses integer default 0,
  total_games integer default 0,
  win_streak integer default 0,
  best_streak integer default 0,
  rating integer default 1000,
  elo_rating integer default 1200,
  rank text default 'Unranked',
  rank_badge text default 'Unranked',
  achievements jsonb default '[]',
  friends jsonb default '[]',
  avatar_url text default ''
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references auth.users(id),
  host_name text not null default '',
  status text not null default 'waiting', -- waiting | playing | closed
  player_count integer not null default 1,
  players jsonb not null default '[]', -- [{ id, name, seat, isBot? }]
  settings jsonb not null default '{}', -- { nil, jokers, bagLimit, blindNil, winScore, doubleNil, bagPenalty, spadesBreak, penaltyAmount } (numeric-ish values as strings)
  ready_players jsonb not null default '[]',
  game_state jsonb default '{}', -- see below
  current_turn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- game_state shape (all keyed by table position, not seat number):
-- {
--   phase: 'bid' | 'play' | 'result',
--   hands: { top: [{suit,value}], left: [...], right: [...], bottom: [...] },
--   bids: { top, left, right, bottom },      -- null until that seat bids
--   tricks: { top, left, right, bottom },    -- tricks won this round
--   current_trick: [{ pos, card: {suit,value} }, ...],
--   current_turn: 'bottom'|'left'|'top'|'right',
--   led_suit: 'S'|'H'|'D'|'C'|null,
--   spades_broken: boolean,
--   round_detail: { pos: { bid, taken, bagsEarned, penaltyThisRound, score } } | null,
--   round_scores: { pos: score } | null,     -- this round's delta only
--   running_scores: { pos: { total, bags } } -- added by this client for match totals; additive, safe for other consumers to ignore
-- }
--
-- Position <-> seat mapping is fixed per room: seat 0 = 'bottom',
-- seat 1 = 'left', seat 2 = 'top', seat 3 = 'right'.

create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  won boolean not null default false,
  your_score integer not null default 0,
  opponent_score integer not null default 0,
  rounds integer not null default 0,
  played_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  badge_name text not null,
  description text,
  unlocked_at timestamptz default timezone('utc', now())
);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  friend_id uuid references public.profiles(id),
  status text default 'pending',
  created_at timestamptz default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;

create policy "Anyone can see the leaderboard and profiles." on public.profiles for select using (true);
create policy "Users can create their own profile when they sign up." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can only update their own stats." on public.profiles for update using (auth.uid() = id);

create policy "Anyone can view waiting rooms" on public.rooms for select using (true);
create policy "Signed-in users can create rooms" on public.rooms for insert with check (auth.uid() = host_id);
create policy "Players can update rooms" on public.rooms for update using (auth.uid() is not null);

alter publication supabase_realtime add table public.rooms;

-- Added by this client: concurrent writers (bot timers, multiple human
-- players) each patching game_state with only the keys they're changing
-- need a server-side atomic deep merge, since a plain `update ... set
-- game_state = $1` is a whole-column overwrite with no per-key
-- concurrency control and silently drops concurrent writers' changes.
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce(
        (
          select jsonb_object_agg(
            key,
            case
              when a ? key and b ? key then public.jsonb_deep_merge(a -> key, b -> key)
              when b ? key then b -> key
              else a -> key
            end
          )
          from (
            select key from jsonb_object_keys(a) as key
            union
            select key from jsonb_object_keys(b) as key
          ) all_keys
        ),
        '{}'::jsonb
      )
    else b
  end;
$$;

create or replace function public.merge_room_game_state(p_room_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.rooms
  set game_state = public.jsonb_deep_merge(coalesce(game_state, '{}'::jsonb), p_patch)
  where id = p_room_id
  returning game_state into result;

  return result;
end;
$$;

grant execute on function public.jsonb_deep_merge(jsonb, jsonb) to authenticated;
grant execute on function public.merge_room_game_state(uuid, jsonb) to authenticated;
