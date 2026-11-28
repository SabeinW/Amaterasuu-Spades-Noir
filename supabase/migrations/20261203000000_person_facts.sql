-- Who's who for the AI players: a person's pronouns and who they're married
-- to, so the bots never guess (Jaylen called a wife "he"; Nia thought
-- "baby get him" was meant for her). Anyone without a row here is called by
-- name. Server only: set on request, never from the app.

create table if not exists public.person_facts (
  person_id uuid primary key references public.profiles(id) on delete cascade,
  pronouns text check (pronouns in ('he', 'she', 'they')),
  spouse_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.person_facts enable row level security;
