-- Extend profiles with contact fields imported from StreamFit CSV.
-- Run this before re-running import_members.js so the script can
-- populate email, phone, instagram, and birthday per member.

alter table public.profiles
  add column if not exists email     text,
  add column if not exists phone     text,
  add column if not exists instagram text,
  add column if not exists birthday  date;

-- Allow 'lead' as a valid member status (in addition to the original three).
alter table public.members
  drop constraint if exists members_status_check;

alter table public.members
  add constraint members_status_check
  check (status in ('active', 'inactive', 'suspended', 'lead'));
