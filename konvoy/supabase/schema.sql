-- ============================================================
-- CONVOI — Supabase SQL Schema
-- Run this in your Supabase SQL editor to set up the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────

create table public.users (
  id          uuid primary key default uuid_generate_v4(),
  display_name text not null,
  avatar_color text not null default '#33a86d',
  lang        text not null default 'en',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ─── Vehicles ─────────────────────────────────────────────────

create table public.vehicles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  label       text not null,
  type        text not null check (type in ('petrol','diesel','ev','suv','moto')),
  fuel_type   text not null check (fuel_type in ('petrol_95','petrol_98','diesel','lpg','electric')),
  consumption float not null default 7.0,
  tank_size   float not null default 50.0,
  icon_color  text not null default '#33a86d',
  is_ev       boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─── Convoys ──────────────────────────────────────────────────

create table public.convoys (
  id          uuid primary key default uuid_generate_v4(),
  created_by  uuid not null references public.users(id),
  title       text not null,
  invite_code text not null unique,
  status      text not null default 'preparation'
              check (status in ('preparation','driving','paused','ended')),
  starts_at   timestamptz,
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

-- ─── Convoy Members ───────────────────────────────────────────

create table public.convoy_members (
  id          uuid primary key default uuid_generate_v4(),
  convoy_id   uuid not null references public.convoys(id) on delete cascade,
  user_id     uuid not null references public.users(id),
  vehicle_id  uuid references public.vehicles(id),
  role        text not null default 'member'
              check (role in ('leader','co_leader','member')),
  status      text not null default 'online'
              check (status in ('online','offline','weak_signal')),
  joined_at   timestamptz not null default now(),
  unique (convoy_id, user_id)
);

-- ─── Live Positions ───────────────────────────────────────────

create table public.live_positions (
  id                  uuid primary key default uuid_generate_v4(),
  convoy_member_id    uuid not null references public.convoy_members(id) on delete cascade,
  lat                 float not null,
  lng                 float not null,
  speed               float not null default 0,
  heading             float not null default 0,
  recorded_at         timestamptz not null default now(),
  is_interpolated     boolean not null default false
);

-- Index for fast position lookups per member
create index idx_live_positions_member on public.live_positions(convoy_member_id, recorded_at desc);

-- ─── Stops ────────────────────────────────────────────────────

create table public.stops (
  id            uuid primary key default uuid_generate_v4(),
  convoy_id     uuid not null references public.convoys(id) on delete cascade,
  proposed_by   uuid not null references public.convoy_members(id),
  type          text not null check (type in ('fuel','food','rest','overnight','sightseeing','emergency')),
  name          text not null,
  lat           float not null,
  lng           float not null,
  duration_min  int not null default 15,
  status        text not null default 'proposed'
                check (status in ('proposed','confirmed','passed','cancelled')),
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── Stop Votes ───────────────────────────────────────────────

create table public.stop_votes (
  id                  uuid primary key default uuid_generate_v4(),
  stop_id             uuid not null references public.stops(id) on delete cascade,
  convoy_member_id    uuid not null references public.convoy_members(id),
  reaction            text not null check (reaction in ('approve','decline','neutral')),
  voted_at            timestamptz not null default now(),
  unique (stop_id, convoy_member_id)
);

-- ─── Stop Arrivals ────────────────────────────────────────────

create table public.stop_arrivals (
  id                  uuid primary key default uuid_generate_v4(),
  stop_id             uuid not null references public.stops(id) on delete cascade,
  convoy_member_id    uuid not null references public.convoy_members(id),
  arrived_at          timestamptz not null default now(),
  unique (stop_id, convoy_member_id)
);

-- ─── Status Events ────────────────────────────────────────────

create table public.status_events (
  id                  uuid primary key default uuid_generate_v4(),
  convoy_member_id    uuid not null references public.convoy_members(id) on delete cascade,
  type                text not null check (type in (
                        'departed','running_late','emergency_stop',
                        'fuel_stop','break_needed','technical_issue')),
  lat                 float,
  lng                 float,
  note                text check (char_length(note) <= 120),
  created_at          timestamptz not null default now()
);

-- ─── Notifications ────────────────────────────────────────────

create table public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  convoy_id     uuid not null references public.convoys(id) on delete cascade,
  recipient_id  uuid not null references public.users(id),
  type          text not null,
  payload       jsonb not null default '{}',
  is_read       boolean not null default false,
  sent_at       timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────
-- Enable RLS on all tables (users can only see convoy data they're part of)

alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.convoys enable row level security;
alter table public.convoy_members enable row level security;
alter table public.live_positions enable row level security;
alter table public.stops enable row level security;
alter table public.stop_votes enable row level security;
alter table public.stop_arrivals enable row level security;
alter table public.status_events enable row level security;
alter table public.notifications enable row level security;

-- TODO: Add RLS policies per table once auth is set up
-- Example policy (users can read convoy_members for convoys they belong to):
-- create policy "convoy members visible to participants"
--   on public.convoy_members for select
--   using (
--     convoy_id in (
--       select convoy_id from public.convoy_members where user_id = auth.uid()
--     )
--   );

-- ─── Realtime ─────────────────────────────────────────────────
-- Enable realtime on tables that need live updates

alter publication supabase_realtime add table public.live_positions;
alter publication supabase_realtime add table public.convoy_members;
alter publication supabase_realtime add table public.stops;
alter publication supabase_realtime add table public.stop_votes;
alter publication supabase_realtime add table public.status_events;
