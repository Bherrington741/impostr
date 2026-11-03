-- ============================================================
-- Impostr — Supabase schema (production backend)
-- Run in the Supabase SQL editor when switching
-- NEXT_PUBLIC_BACKEND to "supabase".
-- ============================================================

-- Rooms: the ONLY table exposed to browsers.
-- `public_state` never contains the secret word or the imposter id.
create table if not exists public.rooms (
  code          text primary key check (char_length(code) = 4),
  public_state  jsonb not null,
  -- The PrivateBundle (secret word, imposterId, hidden votes) lives in its
  -- own server-only table below, NOT here, so postgres_changes broadcasts
  -- can never leak it.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Server-only: the room's hidden engine state.
create table if not exists public.room_state_private (
  code            text primary key references public.rooms(code) on delete cascade,
  private_state   jsonb not null,
  updated_at      timestamptz not null default now()
);

-- Per-device identity secrets, registered at join time.
create table if not exists public.room_players (
  code        text not null references public.rooms(code) on delete cascade,
  player_id   text not null,
  secret      text not null,
  joined_at   timestamptz not null default now(),
  primary key (code, player_id)
);

-- Per-player role views, written by the server after roles are dealt.
create table if not exists public.room_views (
  code        text not null,
  player_id   text not null,
  round       int  not null,
  view        jsonb not null,
  written_at  timestamptz not null default now(),
  primary key (code, player_id)
);

-- Presence heartbeats, upserted through the action route.
create table if not exists public.room_presence (
  code        text not null,
  player_id   text not null,
  ts          timestamptz not null default now(),
  primary key (code, player_id)
);

-- ------------------------------------------------------------------
-- Row Level Security: browsers get a narrow read on rooms ONLY.
-- Every private table has NO policy — server routes use the service
-- role which bypasses RLS.
-- ------------------------------------------------------------------
alter table public.rooms            enable row level security;
alter table public.room_state_private enable row level security;
alter table public.room_players     enable row level security;
alter table public.room_views       enable row level security;
alter table public.room_presence    enable row level security;

drop policy if exists "read rooms" on public.rooms;
create policy "read rooms"
  on public.rooms for select
  using (true);

-- ------------------------------------------------------------------
-- Realtime: broadcast public room updates.
-- ------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end $$;

-- Optional housekeeping: drop rooms idle for > 12h.
create or replace function public.prune_rooms() returns void
language sql as $$
  delete from public.rooms where updated_at < now() - interval '12 hours';
$$;
