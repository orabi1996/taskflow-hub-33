CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  message_id text,
  template_name text,
  recipient_email text,
  subject text,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read email log" ON public.email_send_log;
CREATE POLICY "admins read email log" ON public.email_send_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS email_send_log_created_at_idx ON public.email_send_log (created_at DESC);