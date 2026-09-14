export const CHECK_IN = "16:00";
export const CHECK_OUT = "14:00";

/** Datos del negocio. Teléfono del dueño en formato internacional, sin +. */
export const OWNER_WHATSAPP = "56949424791";
export const ADMIN_EMAIL = "benjaguti1015@gmail.com";
export const ADMIN_PASSWORD = "nacho1234";
export const BUSINESS_NAME = "Cabaña y tinaja MH";

/** Tarifas por defecto: domingo a jueves, fin de semana (viernes y sábado) y feriados. */
export type Rates = { weekday: number; weekend: number; holiday: number };
export const DEFAULT_RATES: Rates = { weekday: 60000, weekend: 70000, holiday: 75000 };

/** Saco de leña obligatorio para encender la tinaja. Se paga en efectivo al llegar. */
export const FIREWOOD_PRICE = 5000;

export type Reservation = {
  id: string;
  name: string;
  phone: string;
  email: string;
  dates: string[]; // yyyy-mm-dd
  nights: number;
  total: number;
  firewood: boolean;
  createdAt: string;
};

export type Expense = {
  id: string;
  concept: string;
  amount: number;
  date: string; // yyyy-mm-dd
};

const AUTH_KEY = "mh_admin_auth";

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

/** 0 = domingo … 5 = viernes, 6 = sábado */
export const weekdayOf = (key: string) => parseKey(key).getDay();
export const isFriday = (key: string) => weekdayOf(key) === 5;
export const isSaturday = (key: string) => weekdayOf(key) === 6;
export const isWeekend = (key: string) => isFriday(key) || isSaturday(key);

export const shiftDay = (key: string, days: number) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
};

/**
 * Paquete de fin de semana: al tomar un viernes se suma el sábado siguiente
 * y al tomar un sábado se suma el viernes anterior, para no dejar noches sueltas.
 */
export const weekendPackage = (key: string) => {
  if (isFriday(key)) return [key, shiftDay(key, 1)];
  if (isSaturday(key)) return [shiftDay(key, -1), key];
  return [key];
};

export const normalizeRates = (value: unknown): Rates => {
  const v = (value ?? {}) as Partial<Rates>;
  return {
    weekday: Number(v.weekday) > 0 ? Number(v.weekday) : DEFAULT_RATES.weekday,
    weekend: Number(v.weekend) > 0 ? Number(v.weekend) : DEFAULT_RATES.weekend,
    holiday: Number(v.holiday) > 0 ? Number(v.holiday) : DEFAULT_RATES.holiday,
  };
};

/** Tarifa base del día: feriado > fin de semana > domingo a jueves. */
export const rateForDay = (
  day: string,
  rates: Rates = DEFAULT_RATES,
  holidays: string[] = [],
) => (holidays.includes(day) ? rates.holiday : isWeekend(day) ? rates.weekend : rates.weekday);

export const priceForDay = (
  day: string,
  rates: Rates = DEFAULT_RATES,
  offers: Record<string, number> = {},
  holidays: string[] = [],
) => offers[day] ?? rateForDay(day, rates, holidays);

export const totalForDays = (
  days: string[],
  rates: Rates,
  offers: Record<string, number>,
  holidays: string[] = [],
) => days.reduce((sum, d) => sum + priceForDay(d, rates, offers, holidays), 0);

export const bookedDays = (list: Reservation[]) => list.flatMap((r) => r.dates);

/** Rango del período actual: semana (lunes a domingo) o mes en curso. */
export const periodRange = (period: "week" | "month", ref: Date = new Date()) => {
  if (period === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { start: toKey(start), end: toKey(end) };
  }
  const offset = (ref.getDay() + 6) % 7;
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offset);
  const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offset + 6);
  return { start: toKey(start), end: toKey(end) };
};

export const inRange = (day: string, range: { start: string; end: string }) =>
  day >= range.start && day <= range.end;

/** Ingresos del período: reparte el total de cada reserva entre sus noches. */
export const incomeInRange = (
  list: Reservation[],
  range: { start: string; end: string },
) =>
  list.reduce(
    (sum, r) =>
      sum + r.dates.filter((d) => inRange(d, range)).length * (r.total / (r.nights || 1)),
    0,
  );

export const expensesInRange = (list: Expense[], range: { start: string; end: string }) =>
  list.filter((e) => inRange(e.date, range)).reduce((s, e) => s + e.amount, 0);

export const isAdminLogged = () =>
  typeof window !== "undefined" && window.sessionStorage.getItem(AUTH_KEY) === "1";
export const setAdminLogged = (v: boolean) => {
  if (typeof window === "undefined") return;
  if (v) window.sessionStorage.setItem(AUTH_KEY, "1");
  else window.sessionStorage.removeItem(AUTH_KEY);
};

export const formatCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export const formatDay = (key: string) =>
  parseKey(key).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

export const formatDayLong = (key: string) =>
  parseKey(key).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });
