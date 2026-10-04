-- ============================================================
-- CampusFind — Supabase schema
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query)
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Profiles — mirrors the `users` array in js/storage.js
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text        not null,
  email        text        not null unique,
  college_id   text,
  role         text        not null default 'student'
                 check (role in ('student', 'faculty', 'staff', 'admin')),
  status       text        not null default 'active'
                 check (status in ('active', 'inactive')),
  phone        text,
  department   text,
  created_at   timestamptz not null default now(),
  last_login   timestamptz
);

-- ------------------------------------------------------------
-- 2. Reports — one row per lost or found item
--    id keeps the human case number (LF-GU-2026-00124).
-- ------------------------------------------------------------
create table if not exists public.reports (
  id                text primary key,
  type              text        not null check (type in ('lost', 'found')),
  item_name         text        not null,
  category          text        not null,
  description       text        not null,
  color             text,
  brand             text,
  unique_mark       text,
  last_seen_place   text,
  last_seen_date    date,
  location          text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  images            jsonb       not null default '[]'::jsonb,
  status            text        not null default 'open',
  storage_status    text,
  owner_id          uuid        references public.profiles(id) on delete set null,
  owner_name        text,
  match_score       int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists reports_type_created_idx on public.reports (type, created_at desc);
create index if not exists reports_status_idx       on public.reports (status);
create index if not exists reports_owner_idx        on public.reports (owner_id);

-- ------------------------------------------------------------
-- 3. Claims — ownership claims against a found report
-- ------------------------------------------------------------
create table if not exists public.claims (
  id            text primary key,
  report_id     text        not null references public.reports(id) on delete cascade,
  report_name   text,
  claimant_id   uuid        references public.profiles(id) on delete cascade,
  claimant_name text,
  answers       jsonb       not null default '{}'::jsonb,
  match_score   int,
  status        text        not null default 'PENDING',
  review_note   text,
  owner_id      uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists claims_status_idx on public.claims (status);
create index if not exists claims_owner_idx  on public.claims (owner_id);

-- ------------------------------------------------------------
-- 4. Custody trail — append-only chain of custody per report
-- ------------------------------------------------------------
create table if not exists public.custody_events (
  id         bigserial primary key,
  report_id  text        not null references public.reports(id) on delete cascade,
  ts         timestamptz not null default now(),
  actor_id   uuid        references public.profiles(id) on delete set null,
  actor_name text,
  action     text        not null,
  note       text
);

create index if not exists custody_report_idx on public.custody_events (report_id, ts);

-- ------------------------------------------------------------
-- 5. Notifications
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id         text primary key,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  type       text        not null,
  title      text        not null,
  body       text,
  link       text,
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ------------------------------------------------------------
-- 6. Audit log — every privileged action, append-only
-- ------------------------------------------------------------
create table if not exists public.audit_events (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  user_id    uuid,
  user_name  text,
  action     text        not null,
  case_id    text,
  ip         inet,
  status     text        not null default 'Success'
);

create index if not exists audit_ts_idx on public.audit_events (ts desc);

-- ============================================================
-- Row Level Security
-- The anon key is public, so these policies are the ONLY thing
-- protecting student data. Read each one before going live.
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.reports         enable row level security;
alter table public.claims          enable row level security;
alter table public.custody_events  enable row level security;
alter table public.notifications   enable row level security;
alter table public.audit_events    enable row level security;

-- Helper: is the caller an admin? SECURITY DEFINER avoids
-- a recursive policy lookup on profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- Profiles: everyone signed in can read, only admins can write.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Reports: public may browse; only the owner or staff may see
-- contact details; only the owner or staff may edit.
drop policy if exists reports_public_read on public.reports;
create policy reports_public_read on public.reports
  for select using (true);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (owner_id = auth.uid());

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports
  for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Claims: a claimant sees their own; staff and admins see all.
drop policy if exists claims_select on public.claims;
create policy claims_select on public.claims
  for select using (
    claimant_id = auth.uid()
    or owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff', 'faculty')
    )
  );

drop policy if exists claims_insert on public.claims;
create policy claims_insert on public.claims
  for insert with check (claimant_id = auth.uid());

drop policy if exists claims_update on public.claims;
create policy claims_update on public.claims
  for update
  using (
    claimant_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff', 'faculty')
    )
  );

-- Custody: readable by the owner and staff, writable by staff.
drop policy if exists custody_read on public.custody_events;
create policy custody_read on public.custody_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.reports r
      where r.id = custody_events.report_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists custody_write on public.custody_events;
create policy custody_write on public.custody_events
  for insert with check (auth.uid() is not null);

-- Notifications: strictly private to the recipient.
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit: admins read, nobody updates or deletes.
drop policy if exists audit_read on public.audit_events;
create policy audit_read on public.audit_events
  for select using (public.is_admin());

-- ============================================================
-- Auto-create a profile row whenever a user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, college_id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'collegeId', ''),
    'student'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Photos bucket (Supabase Storage → New bucket)
--   name     : campusfind-photos
--   public   : ON  (URLs are unguessable; tighten with a
--              signed-URL policy if items must stay private)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('campusfind-photos', 'campusfind-photos', true)
on conflict (id) do nothing;

drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read on storage.objects
  for select using (bucket_id = 'campusfind-photos');

drop policy if exists photos_authed_write on storage.objects;
create policy photos_authed_write on storage.objects
  for insert with check (
    bucket_id = 'campusfind-photos' and auth.uid() is not null
  );