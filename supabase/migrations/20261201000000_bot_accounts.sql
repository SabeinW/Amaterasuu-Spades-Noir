-- AI players with their own accounts: three couples (Big Dre & Keisha,
-- Jaylen & Nia, Malik & Jada) who can be added as friends, invited to a
-- table, play with the "pro" brain (supabase/functions/_shared/pro.js) and
-- talk at the table through the `bots` edge function.
--
-- Their accounts are ordinary auth users + profiles (so they level up and
-- show on the leaderboard, tagged as AI). Which profiles are AI lives here,
-- where only the server can write, so nobody can turn their own account
-- into one.

create table if not exists public.bot_accounts (
  id uuid primary key references public.profiles(id) on delete cascade,
  persona text not null unique,
  partner text not null,
  favorite_deck text,
  created_at timestamptz not null default now()
);
alter table public.bot_accounts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'bot_accounts' and policyname = 'Anyone can see who the AI players are') then
    create policy "Anyone can see who the AI players are" on public.bot_accounts for select using (true);
  end if;
end $$;

-- What the bots' AI has cost, one row per day (US Eastern), so the `bots`
-- function can stop at the daily cap. Server only.
create table if not exists public.bot_usage (
  day date primary key,
  calls integer not null default 0,
  fallbacks integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);
alter table public.bot_usage enable row level security;

-- The recent table talk the bots remember for each table (talk itself goes
-- over realtime and isn't stored anywhere else), plus the last game moment
-- they reacted to so two players' apps can't both set them off. Server only.
create table if not exists public.bot_room_talk (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  lines jsonb not null default '[]',
  last_event text,
  last_reply_at timestamptz,
  recent_replies jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.bot_room_talk enable row level security;

-- Today's spend so far (US Eastern day).
create or replace function public.bot_spend_today()
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce((select cost_usd from public.bot_usage where day = (now() at time zone 'America/New_York')::date), 0)
$$;

create or replace function public.bot_spend_add(p_cost numeric, p_in integer, p_out integer, p_fallback boolean)
returns numeric
language sql
security definer
set search_path = public
as $$
  insert into public.bot_usage as u (day, calls, fallbacks, input_tokens, output_tokens, cost_usd)
  values ((now() at time zone 'America/New_York')::date, case when p_fallback then 0 else 1 end, case when p_fallback then 1 else 0 end, p_in, p_out, p_cost)
  on conflict (day) do update set
    calls = u.calls + excluded.calls,
    fallbacks = u.fallbacks + excluded.fallbacks,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cost_usd = u.cost_usd + excluded.cost_usd
  returning cost_usd
$$;

revoke all on function public.bot_spend_today() from public, anon, authenticated;
revoke all on function public.bot_spend_add(numeric, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.bot_spend_today() to service_role;
grant execute on function public.bot_spend_add(numeric, integer, integer, boolean) to service_role;

-- A friend request to an AI player is accepted straight away.
create or replace function public.bots_accept_friend_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.bot_accounts b where b.id = new.friend_id) then
    new.status := 'accepted';
  end if;
  return new;
end
$$;

drop trigger if exists bots_accept_friend_requests on public.friends;
create trigger bots_accept_friend_requests
  before insert on public.friends
  for each row execute function public.bots_accept_friend_requests();
