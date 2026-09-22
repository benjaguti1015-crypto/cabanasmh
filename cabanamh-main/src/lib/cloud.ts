import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_RATES,
  type Expense,
  type Rates,
  type Reservation,
  normalizeRates,
} from "@/lib/booking";

export type CabinData = {
  reservations: Reservation[];
  blocked: string[];
  offers: Record<string, number>;
  holidays: string[];
  rates: Rates;
  expenses: Expense[];
};

const EMPTY: CabinData = {
  reservations: [],
  blocked: [],
  offers: {},
  holidays: [],
  rates: DEFAULT_RATES,
  expenses: [],
};

type ReservationRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  dates: string[] | null;
  nights: number;
  total: number;
  firewood: boolean | null;
  adults?: number | null;
  children?: number | null;
  created_at: string;
  status?: "pendiente" | "pagado" | null;
};

export async function fetchCabinData(): Promise<CabinData> {
  const [res, blk, off, hol, exp, set] = await Promise.all([
    supabase.from("reservations").select("*").order("created_at", { ascending: true }),
    supabase.from("blocked_days").select("day"),
    supabase.from("offer_days").select("day, price"),
    supabase.from("holiday_days").select("day"),
    supabase.from("expenses").select("*").order("created_at", { ascending: true }),
    supabase.from("settings").select("value").eq("key", "rates").maybeSingle(),
  ]);

  const reservations: Reservation[] = ((res.data ?? []) as ReservationRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    dates: [...(r.dates ?? [])].sort(),
    nights: r.nights,
    total: r.total,
    firewood: r.firewood ?? false,
    adults: r.adults ?? 1,
    children: r.children ?? 0,
    createdAt: r.created_at,
    status: r.status ?? "pendiente",
  }));

  const offers: Record<string, number> = {};
  ((off.data ?? []) as { day: string; price: number }[]).forEach((o) => {
    offers[o.day] = o.price;
  });

  return {
    reservations,
    blocked: ((blk.data ?? []) as { day: string }[]).map((b) => b.day).sort(),
    offers,
    holidays: ((hol.data ?? []) as { day: string }[]).map((h) => h.day).sort(),
    rates: normalizeRates(set.data?.value),
    expenses: ((exp.data ?? []) as { id: string; concept: string; amount: number; date: string }[]).map(
      (e) => ({ id: e.id, concept: e.concept, amount: e.amount, date: e.date }),
    ),
  };
}

/** Datos de la cabaña sincronizados en tiempo real entre todos los dispositivos. */
export function useCabinData() {
  const [data, setData] = useState<CabinData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const next = await fetchCabinData();
    setData(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchCabinData().then((next) => {
      if (!alive) return;
      setData(next);
      setLoading(false);
    });

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetchCabinData().then((next) => {
          if (alive) setData(next);
        });
      }, 120);
    };

    const channel = supabase.channel("cabin-sync");
    [
      "reservations",
      "blocked_days",
      "offer_days",
      "holiday_days",
      "expenses",
      "settings",
    ].forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    });
    channel.subscribe();

    const onFocus = () => schedule();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { data, loading, reload };
}

/* ------------------------- Mutaciones ------------------------- */

export async function createReservation(input: {
  name: string;
  phone: string;
  email: string;
  dates: string[];
  total: number;
  firewood: boolean;
  adults: number;
  children: number;
}) {
  const { data, error } = await (supabase.from("reservations") as any)
    .insert({
      name: input.name,
      phone: input.phone,
      email: input.email,
      dates: input.dates,
      nights: input.dates.length,
      total: input.total,
      firewood: input.firewood,
      adults: input.adults,
      children: input.children,
      status: "pendiente",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al crear reserva:", error);
    return { error: "failed" as const };
  }
  return { id: data.id };
}

export async function updateReservationDates(id: string, dates: string[], total: number) {
  const { error } = await (supabase.from("reservations") as any)
    .update({ dates, nights: dates.length, total })
    .eq("id", id);
  return !error;
}

export async function updateReservationStatus(id: string, status: "pendiente" | "pagado") {
  const { error } = await (supabase.from("reservations") as any)
    .update({ status })
    .eq("id", id);
  
  if (error) {
    console.error("Error al actualizar estado en Supabase:", error);
  }
  return !error;
}

export async function deleteReservation(id: string) {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar reserva en Supabase:", error);
  }
  return !error;
}

export async function setBlockedDays(days: string[], block: boolean) {
  if (!days.length) return true;
  const { error } = block
    ? await supabase.from("blocked_days").upsert(days.map((day) => ({ day })), { onConflict: "day" })
    : await supabase.from("blocked_days").delete().in("day", days);
  return !error;
}

export async function setOfferDays(days: string[], price: number) {
  const { error } = await supabase
    .from("offer_days")
    .upsert(days.map((day) => ({ day, price: Math.max(0, Math.round(price)) })), { onConflict: "day" });
  return !error;
}

export async function removeOfferDays(days: string[]) {
  const { error } = await supabase.from("offer_days").delete().in("day", days);
  return !error;
}

/** Marca o desmarca días como feriados (tarifa especial). */
export async function setHolidayDays(days: string[], holiday: boolean) {
  if (!days.length) return true;
  const { error } = holiday
    ? await supabase.from("holiday_days").upsert(days.map((day) => ({ day })), { onConflict: "day" })
    : await supabase.from("holiday_days").delete().in("day", days);
  return !error;
}

export async function saveRates(rates: Rates) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "rates", value: rates, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return !error;
}

export async function addExpense(concept: string, amount: number, date: string) {
  const { error } = await supabase.from("expenses").insert({ concept, amount, date });
  return !error;
}

export async function removeExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  return !error;
}

/** Diagnóstico simple de la conexión con la nube para el panel. */
export async function checkCloudStatus() {
  const started = Date.now();
  const { error } = await supabase.from("reservations").select("id").limit(1);
  return { ok: !error, ms: Date.now() - started, message: error?.message ?? "Conexión correcta" };
}