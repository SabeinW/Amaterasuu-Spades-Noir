-- Baseline: the schema the live "Spades Noir" project already had before the
-- Nov 2026 server-authoritative rewrite (see ../schema.sql for the history).
-- Written idempotently so it is safe on the live database too, but it is
-- only needed to stand up a fresh/local project.

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
  status text not null default 'waiting',
  player_count integer not null default 1,
  players jsonb not null default '[]',
  settings jsonb not null default '{}',
  ready_players jsonb not null default '[]',
  game_state jsonb default '{}',
  current_turn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Anyone can see the leaderboard and profiles.') then
    create policy "Anyone can see the leaderboard and profiles." on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can create their own profile when they sign up.') then
    create policy "Users can create their own profile when they sign up." on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can only update their own stats.') then
    create policy "Users can only update their own stats." on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'rooms' and policyname = 'Anyone can view waiting rooms') then
    create policy "Anyone can view waiting rooms" on public.rooms for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
