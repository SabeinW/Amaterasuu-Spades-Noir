-- Push notifications (Web Push). Each phone or computer that turns
-- notifications on saves one row here; the `push` edge function reads them
-- with the service role to send invites and friend requests.
--
-- The VAPID key pair lives in Supabase Vault, never in this repo. Create it once
-- per project (keys from scripts/push/vapid-keys.mjs):
--   select vault.create_secret('{"publicKey":"…","privateKey":"…"}', 'vapid_keys');

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "See my devices" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "Remove my devices" on public.push_subscriptions for delete using (auth.uid() = user_id);
grant select, delete on public.push_subscriptions to authenticated;

-- Saves this device for the signed-in player. A device follows whoever is
-- signed in on it, so an endpoint saved earlier under another account moves.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'That is not a push subscription.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- One row per notification already sent, so the same invite or request can't
-- be pushed twice. Only the edge function (service role) touches it.
create table if not exists public.push_sent (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.push_sent enable row level security;

-- The VAPID keys, for the edge function only.
create or replace function public.push_vapid_keys()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_keys' limit 1;
$$;
revoke all on function public.push_vapid_keys() from public, anon, authenticated;
grant execute on function public.push_vapid_keys() to service_role;
