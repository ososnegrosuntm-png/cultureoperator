-- Migration 007: Add active_pending_verify to members status constraint
-- Required for CSV import workflow (StreamFit member import May 14 2026)

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members
  ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'lead', 'active_pending_verify'));
