-- Levels (XP) and in-app table invites.
--
-- XP is earned only on the server: apply_match_result (online matches, called
-- by the `game` edge function, and practice via record_practice_result at half
-- rate) and a trigger on achievements. Players can't write it themselves:
-- profiles UPDATE stays limited to (username, avatar_url).

-- ── XP ─────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists xp integer not null default 0;

-- Back-date XP for everyone who already played, so nobody starts over at
-- level 1: a win is worth 100, a loss 40, each achievement earned 25.
update public.profiles p set xp =
  coalesce(p.wins, 0) * 100
  + coalesce(p.losses, 0) * 40
  + 25 * (select count(*) from public.achievements a where a.user_id = p.id)
where p.xp = 0;

create index if not exists profiles_xp_idx on public.profiles (xp desc);
create index if not exists profiles_wins_idx on public.profiles (wins desc);
create index if not exists profiles_best_streak_idx on public.profiles (best_streak desc);

-- Same result bookkeeping as before, plus XP: 100 for a win or 40 for a
-- loss, +5 per round played (capped at 20 rounds), times p_scale (practice
-- games against bots pass 0.5). The added parameter has a default, so the
-- edge function's existing named-argument call keeps working unchanged.
drop function if exists public.apply_match_result(uuid, boolean, integer, integer, integer);
create or replace function public.apply_match_result(p_user uuid, p_won boolean, p_your integer, p_opp integer, p_rounds integer, p_scale numeric default 1)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  gain integer := round(((case when p_won then 100 else 40 end) + least(greatest(p_rounds, 0), 20) * 5) * greatest(least(p_scale, 1), 0));
begin
  insert into public.match_history (user_id, won, your_score, opponent_score, rounds)
  values (p_user, p_won, p_your, p_opp, p_rounds);

  insert into public.profiles (id, username)
  values (p_user, 'player' || substr(replace(p_user::text, '-', ''), 1, 6))
  on conflict do nothing;

  update public.profiles set
    games_played = coalesce(games_played, 0) + 1,
    total_games = coalesce(total_games, 0) + 1,
    wins = coalesce(wins, 0) + (case when p_won then 1 else 0 end),
    losses = coalesce(losses, 0) + (case when p_won then 0 else 1 end),
    win_streak = case when p_won then coalesce(win_streak, 0) + 1 else 0 end,
    best_streak = greatest(coalesce(best_streak, 0), case when p_won then coalesce(win_streak, 0) + 1 else 0 end),
    rating = coalesce(rating, 1000) + (case when p_won then 15 else -10 end),
    elo_rating = coalesce(elo_rating, 1200) + (case when p_won then 15 else -10 end),
    xp = coalesce(xp, 0) + gain
  where id = p_user
  returning * into result;
  return result;
end;
$$;
revoke all on function public.apply_match_result(uuid, boolean, integer, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.apply_match_result(uuid, boolean, integer, integer, integer, numeric) to service_role;

create or replace function public.record_practice_result(p_won boolean, p_your integer, p_opp integer, p_rounds integer)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_rounds < 1 or p_rounds > 60 or abs(p_your) > 3000 or abs(p_opp) > 3000 then
    raise exception 'implausible result';
  end if;
  select max(played_at) into last_at from public.match_history where user_id = auth.uid();
  if last_at is not null and last_at > now() - interval '60 seconds' then
    raise exception 'too soon after the last recorded game';
  end if;
  return public.apply_match_result(auth.uid(), p_won, p_your, p_opp, p_rounds, 0.5);
end;
$$;
revoke all on function public.record_practice_result(boolean, integer, integer, integer) from public, anon;
grant execute on function public.record_practice_result(boolean, integer, integer, integer) to authenticated;

-- Each achievement earned is worth 25 XP. Achievements are recorded by the
-- player's own app, so cap how fast they can pay out: at most 12 earns a
-- minute count (a real hand can't earn more than a few at once).
create or replace function public.award_achievement_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.achievements a where a.user_id = new.user_id and a.unlocked_at > now() - interval '1 minute') <= 12 then
    update public.profiles set xp = coalesce(xp, 0) + 25 where id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists achievements_award_xp on public.achievements;
create trigger achievements_award_xp after insert on public.achievements
  for each row execute function public.award_achievement_xp();

-- ── Table invites ──────────────────────────────────────────────────────────
-- "Come sit at my table": one row per invite, only between accepted friends.
-- The invited player's app listens for new rows (realtime) and offers Join.
create table if not exists public.table_invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  room_code text not null check (room_code ~ '^\d{4}$'),
  created_at timestamptz not null default now()
);
create index if not exists table_invites_to_user_idx on public.table_invites (to_user, created_at desc);

alter table public.table_invites enable row level security;
drop policy if exists "See invites to or from me" on public.table_invites;
create policy "See invites to or from me" on public.table_invites
  for select using (auth.uid() = from_user or auth.uid() = to_user);
drop policy if exists "Invite my friends" on public.table_invites;
create policy "Invite my friends" on public.table_invites
  for insert with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.friends f
      where f.status = 'accepted'
        and ((f.user_id = from_user and f.friend_id = to_user) or (f.user_id = to_user and f.friend_id = from_user))
    )
  );
drop policy if exists "Clear my invites" on public.table_invites;
create policy "Clear my invites" on public.table_invites
  for delete using (auth.uid() = from_user or auth.uid() = to_user);

grant select, insert, delete on public.table_invites to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'table_invites') then
    alter publication supabase_realtime add table public.table_invites;
  end if;
end $$;
