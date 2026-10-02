-- Migration: Daily Journal Submissions & Manager Approval Workflow
-- Allows employees to submit daily work journals for review and managers to approve/request revisions

CREATE TABLE IF NOT EXISTS public.daily_journal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_date date NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'revision_requested')),
  total_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  total_minutes integer NOT NULL DEFAULT 0,
  employee_notes text,
  manager_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_journal_date UNIQUE (user_id, journal_date)
);

-- Indexes for performant lookups
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON public.daily_journal_submissions (user_id, journal_date);
CREATE INDEX IF NOT EXISTS idx_journal_status_date ON public.daily_journal_submissions (status, journal_date);
CREATE INDEX IF NOT EXISTS idx_journal_reviewed_by ON public.daily_journal_submissions (reviewed_by);

-- Enable RLS
ALTER TABLE public.daily_journal_submissions ENABLE ROW LEVEL SECURITY;

-- Helper to check manager/admin access
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'general_manager', 'manager')
  );
$$;

-- RLS Policies
DROP POLICY IF EXISTS "daily_journal_select" ON public.daily_journal_submissions;
CREATE POLICY "daily_journal_select"
ON public.daily_journal_submissions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_manager_or_above()
);

DROP POLICY IF EXISTS "daily_journal_insert" ON public.daily_journal_submissions;
CREATE POLICY "daily_journal_insert"
ON public.daily_journal_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR public.is_manager_or_above()
);

DROP POLICY IF EXISTS "daily_journal_update" ON public.daily_journal_submissions;
CREATE POLICY "daily_journal_update"
ON public.daily_journal_submissions
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.is_manager_or_above()
)
WITH CHECK (
  user_id = auth.uid() OR public.is_manager_or_above()
);

DROP POLICY IF EXISTS "daily_journal_delete" ON public.daily_journal_submissions;
CREATE POLICY "daily_journal_delete"
ON public.daily_journal_submissions
FOR DELETE
TO authenticated
USING (
  public.is_manager_or_above()
);
