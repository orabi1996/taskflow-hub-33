CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (public.is_admin_or_gm(auth.uid()));

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  muted_types text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification prefs"
ON public.notification_prefs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view notification prefs"
ON public.notification_prefs FOR SELECT TO authenticated
USING (public.is_admin_or_gm(auth.uid()));

CREATE TABLE public.notification_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid,
  channel text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_delivery_log TO authenticated;
GRANT ALL ON public.notification_delivery_log TO service_role;
ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view delivery log"
ON public.notification_delivery_log FOR SELECT TO authenticated
USING (public.is_admin_or_gm(auth.uid()));

CREATE INDEX idx_notification_delivery_log_created ON public.notification_delivery_log(created_at DESC);

CREATE TRIGGER set_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_notification_prefs_updated_at
BEFORE UPDATE ON public.notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();