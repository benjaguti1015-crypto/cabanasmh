CREATE TABLE public.holiday_days (
  day text PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_days TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_days TO authenticated;
GRANT ALL ON public.holiday_days TO service_role;
ALTER TABLE public.holiday_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holiday_days_public_all" ON public.holiday_days FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.holiday_days REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holiday_days;

ALTER TABLE public.reservations ADD COLUMN firewood boolean NOT NULL DEFAULT false;