-- =============================================================================
-- Meetly — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- meetings: one row per created meeting room
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  title       text,
  host_name   text,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz,
  is_active   boolean not null default true
);

create index if not exists meetings_code_idx on public.meetings (code);

-- ---------------------------------------------------------------------------
-- chat_messages: persisted in-meeting chat
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  meeting_code  text not null references public.meetings (code) on delete cascade,
  sender_id     text not null,
  sender_name   text not null,
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists chat_messages_meeting_idx
  on public.chat_messages (meeting_code, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This app uses link-based access (anyone with the meeting code can join),
-- so we allow the anonymous role to read/write. Tighten these policies if you
-- add authentication and want private meetings.
-- ---------------------------------------------------------------------------
alter table public.meetings      enable row level security;
alter table public.chat_messages enable row level security;

-- meetings policies
drop policy if exists "meetings_select" on public.meetings;
create policy "meetings_select" on public.meetings
  for select using (true);

drop policy if exists "meetings_insert" on public.meetings;
create policy "meetings_insert" on public.meetings
  for insert with check (true);

drop policy if exists "meetings_update" on public.meetings;
create policy "meetings_update" on public.meetings
  for update using (true) with check (true);

-- chat_messages policies
drop policy if exists "chat_select" on public.chat_messages;
create policy "chat_select" on public.chat_messages
  for select using (true);

drop policy if exists "chat_insert" on public.chat_messages;
create policy "chat_insert" on public.chat_messages
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: enable change broadcasts for chat (used as a fallback / history).
-- Live signaling uses Realtime "broadcast" channels which need no table.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
