import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bath,
  Bed,
  Car,
  Check,
  Clock,
  Flame,
  Info,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShowerHead,
  Sparkles,
  Tv,
  User,
  UtensilsCrossed,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/logo-mh.jpg.asset.json";
import { BookingCalendar } from "@/components/BookingCalendar";
import { createReservation, useCabinData } from "@/lib/cloud";
import {
  ADMIN_EMAIL,
  BUSINESS_NAME,
  CHECK_IN,
  CHECK_OUT,
  FIREWOOD_PRICE,
  OWNER_WHATSAPP,
  bookedDays,
  formatCLP,
  formatDay,
  isWeekend,
  priceForDay,
  rateForDay,
  totalForDays,
  weekendPackage,
} from "@/lib/booking";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cabaña y tinaja MH — Reserva tu estadía" },
      {
        name: "description",
        content:
          "Reserva online en Cabaña y tinaja MH: tinaja privada con hidromasajes, wifi y parrilla. Domingo a jueves $60.000, viernes y sábado $70.000, feriados $75.000.",
      },
      { property: "og:title", content: "Cabaña y tinaja MH — Reserva tu estadía" },
      {
        property: "og:description",
        content:
          "Disponibilidad en tiempo real. Tarifas para 2 personas: $60.000 entre semana, $70.000 fin de semana y $75.000 feriados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientView,
});

const INCLUDES = [
  { icon: <Bed className="h-4 w-4" />, text: "Cama de 2 plazas y una de plaza y media" },
  { icon: <Bath className="h-4 w-4" />, text: "Tinaja privada con hidromasajes" },
  { icon: <ShowerHead className="h-4 w-4" />, text: "Ducha con hidromasajes y calefont" },
  { icon: <Tv className="h-4 w-4" />, text: "Wifi y Smart TV" },
  {
    icon: <UtensilsCrossed className="h-4 w-4" />,
    text: "Cocina a gas, refrigerador, hervidor, ollas y cubiertos",
  },
  { icon: <Flame className="h-4 w-4" />, text: "Estufa" },
  { icon: <Bed className="h-4 w-4" />, text: "Sábanas y frazadas" },
  { icon: <Car className="h-4 w-4" />, text: "Estacionamiento privado" },
  { icon: <Flame className="h-4 w-4" />, text: "Parrilla" },
];

const EXCLUDES = ["Cable de TV", "Toallas", "Secador de pelo"];

function ClientView() {
  const { data, loading } = useCabinData();
  const [selected, setSelected] = useState<string[]>([]);
  const firewood = true;
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const { rates, offers, holidays } = data;
  const occupied = useMemo(
    () => [...bookedDays(data.reservations), ...data.blocked],
    [data.reservations, data.blocked],
  );

  const nights = selected.length;
  const nightsTotal = useMemo(
    () => totalForDays(selected, rates, offers, holidays),
    [selected, rates, offers, holidays],
  );
  const total = nightsTotal;
  const savings = useMemo(
    () =>
      selected.reduce(
        (s, d) =>
          s +
          Math.max(0, rateForDay(d, rates, holidays) - priceForDay(d, rates, offers, holidays)),
        0,
      ),
    [selected, rates, offers, holidays],
  );

  /** Viernes y sábado se seleccionan y liberan juntos (paquete de fin de semana). */
  const toggle = (day: string) => {
    const group = weekendPackage(day);
    const isOn = selected.includes(day);
    if (!isOn && group.some((d) => occupied.includes(d))) {
      toast.error("Ese fin de semana no está completamente libre.");
      return;
    }
    setSelected((prev) => {
      const next = isOn
        ? prev.filter((d) => !group.includes(d))
        : Array.from(new Set([...prev, ...group]));
      return next.sort();
    });
    if (!isOn && group.length > 1) {
      toast.info("Los fines de semana se reservan como paquete: viernes y sábado juntos.");
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!nights) {
      toast.error("Selecciona al menos una noche.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Completa todos los campos.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Correo no válido.");
      return;
    }

    setSending(true);
    const dates = [...selected].sort();
    const result = await createReservation({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      dates,
      total,
      firewood,
    });
    setSending(false);

    if (result.error === "conflict") {
      setSelected([]);
      toast.error("Alguien acaba de tomar esas noches. El calendario ya se actualizó.");
      return;
    }
    if (result.error) {
      toast.error("No pudimos guardar la reserva. Intenta de nuevo.");
      return;
    }

    const detalle =
      `Nueva reserva en ${BUSINESS_NAME}%0A%0A` +
      `Cliente: ${form.name.trim()}%0A` +
      `Teléfono: ${form.phone.trim()}%0A` +
      `Correo: ${form.email.trim()}%0A` +
      `Noches: ${nights}%0A` +
      `Fechas: ${dates.map(formatDay).join(", ")}%0A` +
      `Saco de leña para la tinaja: 1 saco obligatorio (${formatCLP(FIREWOOD_PRICE)}, se paga en efectivo al llegar a la cabaña)%0A` +
      `Check-in ${CHECK_IN} · Check-out ${CHECK_OUT}%0A` +
      `Total reserva (pago online): ${formatCLP(total)}%0A` +
      `Leña (efectivo al llegar, no incluida en el total): ${formatCLP(FIREWOOD_PRICE)}`;

    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${detalle}`, "_blank");

    const body = detalle.replace(/%0A/g, "\n");
    window.open(
      `mailto:${form.email.trim()}?cc=${ADMIN_EMAIL}&subject=${encodeURIComponent(
        `Confirmación de reserva — ${BUSINESS_NAME}`,
      )}&body=${encodeURIComponent(body)}`,
    );

    setSelected([]);
    setForm({ name: "", phone: "", email: "" });
    setDone(true);
    toast.success("¡Reserva confirmada! Te enviamos la confirmación por correo.");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo.url}
              alt="Logotipo Cabaña y tinaja MH"
              className="h-10 w-10 shrink-0 rounded-full sm:h-12 sm:w-12"
            />
            <div className="min-w-0">
              <p className="text-hero truncate text-base leading-tight sm:text-xl">{BUSINESS_NAME}</p>
              <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                Cabaña · Tinaja · Naturaleza
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            aria-label="Administrador"
            className="flex shrink-0 items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-4"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Administrador</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-10">
        <section className="mb-8 sm:mb-10">
          <h1 className="text-hero text-3xl sm:text-5xl">Reserva tu estadía</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Elige las noches disponibles en el calendario y confirma en menos de un minuto.
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Wifi className="h-3.5 w-3.5 shrink-0 text-primary" />
            {loading ? "Cargando disponibilidad…" : "Disponibilidad sincronizada en tiempo real"}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoCard icon={<LogIn className="h-4 w-4" />} label="Check-in" value={`${CHECK_IN} hrs`} />
            <InfoCard icon={<LogOut className="h-4 w-4" />} label="Check-out" value={`${CHECK_OUT} hrs`} />
            <InfoCard
              icon={<Clock className="h-4 w-4" />}
              label="Desde"
              value={formatCLP(rates.weekday)}
              hint="por noche, 2 personas"
            />
          </div>
        </section>

        {/* Panel informativo de tarifas y detalles */}
        <section className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-soft sm:mb-10 sm:p-6">
          <h2 className="flex items-center gap-2 text-hero text-2xl">
            <Info className="h-5 w-5 shrink-0 text-primary" /> Información y tarifas
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valores por noche para 2 personas. Check-in {CHECK_IN} hrs · Check-out {CHECK_OUT} hrs.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <RateCard
              label="Domingo a jueves"
              value={formatCLP(rates.weekday)}
              hint="Por noche"
            />
            <RateCard
              label="Viernes y sábado"
              value={formatCLP(rates.weekend)}
              hint="Se agenda viernes y sábado juntos (2 noches)"
            />
            <RateCard
              label="Feriados y festivos"
              value={formatCLP(rates.holiday)}
              hint="Días marcados en el calendario"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-start gap-2 text-sm">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">1 saco de leña obligatorio para la tinaja</span>
                <span className="block text-xs text-muted-foreground">
                  La tinaja no tiene costo de arriendo. El saco es obligatorio: lo usamos para
                  encenderla y calentar el agua antes de tu llegada. El valor se cancela en efectivo
                  al momento de llegar a la cabaña; no se cobra en el pago online de la reserva.
                </span>
              </span>
            </p>
            <span className="text-hero shrink-0 text-xl">{formatCLP(FIREWOOD_PRICE)}</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" /> Incluye la cabaña
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {INCLUDES.map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                No incluye
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {EXCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-2 rounded-xl border border-border p-4 text-xs text-muted-foreground">
                <p>Si deseas salir antes del horario, avísanos con anticipación.</p>
                <p>
                  Recuerda: Check-in a las {CHECK_IN} hrs y Check-out a las {CHECK_OUT} hrs.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <BookingCalendar
            occupied={occupied}
            selected={selected}
            onSelect={toggle}
            offers={offers}
            holidays={holidays}
            holidayRate={rates.holiday}
          />

          <form
            onSubmit={confirm}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
          >
            <h2 className="text-hero text-2xl">Tus datos</h2>

            <div className="mt-4 space-y-3">
              <Field
                icon={<User className="h-4 w-4" />}
                placeholder="Nombre y apellido"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                icon={<Phone className="h-4 w-4" />}
                placeholder="Número de teléfono"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <Field
                icon={<Mail className="h-4 w-4" />}
                placeholder="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            </div>

            <label className="mt-4 flex cursor-not-allowed items-start gap-3 rounded-xl border border-input bg-background px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked
                disabled
                readOnly
                aria-disabled="true"
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary disabled:opacity-100"
              />
              <span className="min-w-0">
                <span className="font-medium">
                  1 saco de leña obligatorio · {formatCLP(FIREWOOD_PRICE)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Incluido en tu reserva. El valor se cancela en efectivo al momento de llegar a la
                  cabaña; no se cobra en el pago online ni en el total de la reserva.
                </span>
              </span>
            </label>

            <div className="mt-6 rounded-xl bg-secondary p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Noches seleccionadas</span>
                <span>{nights}</span>
              </div>
              {nights > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {selected.map((d) => {
                    const base = rateForDay(d, rates, holidays);
                    const p = priceForDay(d, rates, offers, holidays);
                    const tag = holidays.includes(d)
                      ? " · feriado"
                      : isWeekend(d)
                        ? " · fin de semana"
                        : "";
                    return (
                      <li key={d} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {formatDay(d)}
                          {tag}
                        </span>
                        <span className={p < base ? "shrink-0 text-primary" : "shrink-0"}>
                          {formatCLP(p)}
                          {p < base ? " · oferta" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li className="flex justify-between gap-2">
                  <span>Saco de leña (efectivo al llegar)</span>
                  <span className="shrink-0">{formatCLP(FIREWOOD_PRICE)}</span>
                </li>
              </ul>
              {savings > 0 && (
                <p className="mt-2 text-xs text-primary">
                  Ahorras {formatCLP(savings)} con las noches en oferta.
                </p>
              )}
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                <span className="font-medium">Total a pagar online</span>
                <span className="text-hero shrink-0 text-2xl">{formatCLP(total)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                El saco de leña ({formatCLP(FIREWOOD_PRICE)}) se cancela en efectivo al llegar a la
                cabaña y no está incluido en este total.
              </p>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:shadow-lift disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" />
              {sending ? "Guardando…" : "Confirmar reserva"}
            </button>

            {done && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Se abrió WhatsApp con el aviso al dueño y el correo de confirmación con copia al
                administrador.
              </p>
            )}
          </form>
        </div>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        {BUSINESS_NAME} · Check-in {CHECK_IN} hrs · Check-out {CHECK_OUT} hrs
      </footer>
    </div>
  );
}

function RateCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-hero mt-1 text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 text-hero text-2xl">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-input bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <input
        required
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
    </label>
  );
}
