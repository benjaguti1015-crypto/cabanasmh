-- Seguridad: cierra el acceso público total y deja solo al admin (app_metadata.role = 'admin').
-- Idempotente: se puede ejecutar más de una vez.

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS adults integer NOT NULL DEFAULT 1;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS children integer NOT NULL DEFAULT 0;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendiente';

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- 1. Quitar políticas abiertas
DROP POLICY IF EXISTS "reservations_public_all" ON public.reservations;
DROP POLICY IF EXISTS "blocked_days_public_all" ON public.blocked_days;
DROP POLICY IF EXISTS "offer_days_public_all" ON public.offer_days;
DROP POLICY IF EXISTS "expenses_public_all" ON public.expenses;
DROP POLICY IF EXISTS "settings_public_all" ON public.settings;
DROP POLICY IF EXISTS "holiday_days_public_all" ON public.holiday_days;

-- 2. Permisos mínimos para el visitante (anon)
REVOKE ALL ON public.reservations, public.blocked_days, public.offer_days,
  public.expenses, public.settings, public.holiday_days FROM anon;
GRANT INSERT ON public.reservations TO anon;
GRANT SELECT ON public.blocked_days, public.offer_days, public.settings, public.holiday_days TO anon;

-- 3. Admin: todo. Visitantes: solo leer calendario/tarifas y crear reservas.
CREATE POLICY admin_all ON public.reservations  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON public.blocked_days  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON public.offer_days    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON public.holiday_days  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON public.settings      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON public.expenses      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY public_read ON public.blocked_days FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read ON public.offer_days   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read ON public.holiday_days FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read ON public.settings     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_insert ON public.reservations FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4. Funciones públicas que NO exponen datos personales
CREATE OR REPLACE FUNCTION public.public_booked_days() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unnest(dates) FROM public.reservations WHERE status = 'pagado'
$$;

-- Consulta de una reserva por su ID (uuid imposible de adivinar)
CREATE OR REPLACE FUNCTION public.lookup_reservation(p_id uuid)
RETURNS SETOF public.reservations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.reservations WHERE id = p_id
$$;

REVOKE ALL ON FUNCTION public.public_booked_days(), public.lookup_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_booked_days(), public.lookup_reservation(uuid) TO anon, authenticated;

-- 5. Validación y precio calculados en el servidor al crear una reserva
CREATE OR REPLACE FUNCTION public.validate_new_reservation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d text;
  rates jsonb;
  w int; we int; h int;
  sum_total int := 0;
  p int;
BEGIN
  NEW.name := btrim(NEW.name);
  NEW.email := btrim(NEW.email);
  NEW.phone := btrim(NEW.phone);
  IF length(NEW.name) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF length(NEW.email) > 120 OR NEW.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'INVALID_EMAIL'; END IF;
  IF NEW.phone !~ '^\+?[0-9]{8,15}$' THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;

  IF NEW.adults NOT BETWEEN 1 AND 3 OR NEW.children NOT BETWEEN 0 AND 2
     OR (NEW.adults = 3 AND NEW.children > 0) THEN RAISE EXCEPTION 'INVALID_CAPACITY'; END IF;

  IF cardinality(NEW.dates) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(NEW.dates) x) <> cardinality(NEW.dates) THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;

  SELECT value INTO rates FROM public.settings WHERE key = 'rates';
  w  := coalesce((rates ->> 'weekday')::int, 60000);
  we := coalesce((rates ->> 'weekend')::int, 70000);
  h  := coalesce((rates ->> 'holiday')::int, 75000);

  FOREACH d IN ARRAY NEW.dates LOOP
    IF d !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;
    IF d::date < (now() AT TIME ZONE 'America/Santiago')::date THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;
    IF EXISTS (SELECT 1 FROM public.blocked_days WHERE day = d)
       OR EXISTS (SELECT 1 FROM public.reservations WHERE status = 'pagado' AND d = ANY (dates))
    THEN RAISE EXCEPTION 'DATES_TAKEN'; END IF;

    SELECT price INTO p FROM public.offer_days WHERE day = d;
    IF p IS NULL THEN
      p := CASE WHEN EXISTS (SELECT 1 FROM public.holiday_days WHERE day = d) THEN h
                WHEN extract(dow FROM d::date) IN (5, 6) THEN we
                ELSE w END;
    END IF;
    sum_total := sum_total + p;
  END LOOP;

  -- Freno anti-spam: máximo 5 reservas pendientes por correo o teléfono
  IF (SELECT count(*) FROM public.reservations
      WHERE status = 'pendiente' AND (lower(email) = lower(NEW.email) OR phone = NEW.phone)) >= 5
  THEN RAISE EXCEPTION 'TOO_MANY_PENDING'; END IF;

  NEW.nights := cardinality(NEW.dates);
  NEW.total := sum_total + CASE WHEN NEW.adults = 3 THEN 10000 ELSE 0 END;
  NEW.status := 'pendiente';
  NEW.created_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_new_reservation ON public.reservations;
CREATE TRIGGER trg_validate_new_reservation BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.validate_new_reservation();

-- 6. Límites en los datos del admin (defensa extra)
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_chk;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_status_chk CHECK (status IN ('pendiente', 'pagado')) NOT VALID; -- NOT VALID: no revisa filas existentes

-- DESPUÉS de crear el usuario admin en Authentication > Users, ejecutar UNA vez:
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--   WHERE email = 'cabanamh27@gmail.com';
