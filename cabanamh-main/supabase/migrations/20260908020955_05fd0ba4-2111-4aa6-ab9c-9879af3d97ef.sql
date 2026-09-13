CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  dates text[] NOT NULL DEFAULT '{}',
  nights integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO anon, authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_public_all" ON public.reservations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.blocked_days (
  day text NOT NULL PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_days TO anon, authenticated;
GRANT ALL ON public.blocked_days TO service_role;
ALTER TABLE public.blocked_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_days_public_all" ON public.blocked_days FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.offer_days (
  day text NOT NULL PRIMARY KEY,
  price integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_days TO anon, authenticated;
GRANT ALL ON public.offer_days TO service_role;
ALTER TABLE public.offer_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offer_days_public_all" ON public.offer_days FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  concept text NOT NULL,
  amount integer NOT NULL,
  date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon, authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_public_all" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_all" ON public.settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.settings (key, value) VALUES ('rates', '{"weekday":60000,"weekend":70000}'::jsonb);

ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.blocked_days REPLICA IDENTITY FULL;
ALTER TABLE public.offer_days REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_days;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_days;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;