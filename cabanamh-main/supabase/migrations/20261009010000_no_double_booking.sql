-- Evita que el admin marque como "pagada" una reserva cuyas noches ya están pagadas por otra.
CREATE OR REPLACE FUNCTION public.prevent_double_paid() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pagado' AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id <> NEW.id AND r.status = 'pagado' AND r.dates && NEW.dates
  ) THEN
    RAISE EXCEPTION 'DATES_TAKEN';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_double_paid ON public.reservations;
CREATE TRIGGER trg_prevent_double_paid BEFORE INSERT OR UPDATE OF status, dates ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_double_paid();
