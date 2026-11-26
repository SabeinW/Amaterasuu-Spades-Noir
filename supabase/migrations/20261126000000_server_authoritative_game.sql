-- Server-authoritative online play (Nov 2026).
--
-- Before: every client could rewrite any room (RLS "auth.uid() is not null"),
-- all four hands sat in the public rooms.game_state, and one player's browser
-- ("the host") ran the bots, trick evaluation and scoring for everyone — so a
-- host who backgrounded the tab froze the table, and anyone could read every
-- hand from the network tab.
--
-- After: the `game` edge function (service role) is the only writer. Public
-- match state stays in rooms.game_state (no cards in it); the hands live in
-- room_secrets, which clients can't read except their own seat's hand via
-- get_my_hand(). rooms.version gives optimistic concurrency so two moves can
-- never interleave.

alter table public.rooms add column if not exists version integer not null default 0;

-- Codes only need to be unique among live rooms; closed rooms keep their
-- old code without blocking it from being reused.
alter table public.rooms drop constraint if exists rooms_code_key;
create unique index if not exists rooms_live_code_key on public.rooms (code) where status in ('waiting', 'playing');
create index if not exists rooms_status_updated_idx on public.rooms (status, updated_at desc);

create table if not exists public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  hands jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.room_secrets enable row level security;
-- (no policies on purpose: only the service role reads or writes it)

drop policy if exists "Signed-in users can create rooms" on public.rooms;
drop policy if exists "Players can update rooms" on public.rooms;
revoke insert, update, delete on public.rooms from anon, authenticated;

drop function if exists public.merge_room_game_state(uuid, jsonb);
drop function if exists public.jsonb_deep_merge(jsonb, jsonb);

create or replace function public.commit_room(p_room_id uuid, p_version integer, p_room jsonb, p_hands jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_version integer;
begin
  update public.rooms set
    status = coalesce(p_room->>'status', status),
    players = coalesce(p_room->'players', players),
    player_count = coalesce((p_room->>'player_count')::integer, player_count),
    settings = coalesce(p_room->'settings', settings),
    game_state = coalesce(p_room->'game_state', game_state),
    host_id = coalesce((p_room->>'host_id')::uuid, host_id),
    host_name = coalesce(p_room->>'host_name', host_name),
    version = version + 1,
    updated_at = now()
  where id = p_room_id and version = p_version
  returning version into new_version;

  if new_version is null then
    return null;
  end if;

  if p_hands is not null then
    insert into public.room_secrets (room_id, hands, updated_at)
    values (p_room_id, p_hands, now())
    on conflict (room_id) do update set hands = excluded.hands, updated_at = now();
  end if;
  return new_version;
end;
$$;
revoke all on function public.commit_room(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_room(uuid, integer, jsonb, jsonb) to service_role;

-- The caller's own hand in a room they're seated in (null otherwise).
create or replace function public.get_my_hand(p_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.hands -> ((p ->> 'seat')::integer)
  from public.rooms r
  cross join lateral jsonb_array_elements(r.players) as p
  join public.room_secrets s on s.room_id = r.id
  where r.id = p_room_id and p ->> 'id' = auth.uid()::text
  limit 1
$$;
revoke all on function public.get_my_hand(uuid) from public, anon;
grant execute on function public.get_my_hand(uuid) to authenticated;

-- Stats: clients may only edit their name and picture. Results are written
-- by apply_match_result (online: the game function; practice: record_practice_result).
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
revoke insert on public.profiles from anon, authenticated;
grant insert (id, email, username, avatar_url) on public.profiles to authenticated;

create or replace function public.apply_match_result(p_user uuid, p_won boolean, p_your integer, p_opp integer, p_rounds integer)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  insert into public.match_history (user_id, won, your_score, opponent_score, rounds)
  values (p_user, p_won, p_your, p_opp, p_rounds);

  insert into public.profiles (id, username)
  values (p_user, 'player' || substr(replace(p_user::text, '-', ''), 1, 6))
  on conflict (id) do nothing;

  update public.profiles set
    games_played = coalesce(games_played, 0) + 1,
    total_games = coalesce(total_games, 0) + 1,
    wins = coalesce(wins, 0) + (case when p_won then 1 else 0 end),
    losses = coalesce(losses, 0) + (case when p_won then 0 else 1 end),
    win_streak = case when p_won then coalesce(win_streak, 0) + 1 else 0 end,
    best_streak = greatest(coalesce(best_streak, 0), case when p_won then coalesce(win_streak, 0) + 1 else 0 end),
    rating = coalesce(rating, 1000) + (case when p_won then 15 else -10 end),
    elo_rating = coalesce(elo_rating, 1200) + (case when p_won then 15 else -10 end)
  where id = p_user
  returning * into result;
  return result;
end;
$$;
revoke all on function public.apply_match_result(uuid, boolean, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_match_result(uuid, boolean, integer, integer, integer) to service_role;

-- Practice games run in the browser, so their result is self-reported (as
-- before); bounded so a forged call can't do more than a real game could.
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
  return public.apply_match_result(auth.uid(), p_won, p_your, p_opp, p_rounds);
end;
$$;
revoke all on function public.record_practice_result(boolean, integer, integer, integer) from public, anon;
grant execute on function public.record_practice_result(boolean, integer, integer, integer) to authenticated;

-- RLS for the tables that never had it.
alter table public.match_history enable row level security;
drop policy if exists "Own match history" on public.match_history;
create policy "Own match history" on public.match_history for select using (auth.uid() = user_id);

alter table public.achievements enable row level security;
drop policy if exists "Achievements are public" on public.achievements;
create policy "Achievements are public" on public.achievements for select using (true);
drop policy if exists "Earn own achievements" on public.achievements;
create policy "Earn own achievements" on public.achievements for insert with check (auth.uid() = user_id);

alter table public.friends enable row level security;
drop policy if exists "See own friendships" on public.friends;
create policy "See own friendships" on public.friends for select using (auth.uid() in (user_id, friend_id));
drop policy if exists "Send friend requests" on public.friends;
create policy "Send friend requests" on public.friends for insert with check (auth.uid() = user_id);
drop policy if exists "Accept requests sent to you" on public.friends;
create policy "Accept requests sent to you" on public.friends for update using (auth.uid() = friend_id);
drop policy if exists "Remove own friendships" on public.friends;
create policy "Remove own friendships" on public.friends for delete using (auth.uid() in (user_id, friend_id));
