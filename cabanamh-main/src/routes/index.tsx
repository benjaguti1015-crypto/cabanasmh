import { createFileRoute } from "@tanstack/react-router";
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
import emailjs from "@emailjs/browser";

import { BookingCalendar } from "@/components/BookingCalendar";
import { createReservation, useCabinData } from "@/lib/cloud";
import {
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
  
  // Estados para la capacidad de pasajeros
  const [adults, setAdults] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);

  // Estados para términos y condiciones / política de privacidad
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

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
  
  // Recargo de 10.000 si son 3 adultos
  const adultExtra = adults === 3 ? 10000 : 0;
  const total = nightsTotal + adultExtra;

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

    // Validación estricta de capacidad máxima exigida por el dueño
    const esInvalido =
      adults > 3 ||
      childrenCount > 2 ||
      (adults === 3 && childrenCount > 0) ||
      adults + childrenCount > 4;

    if (esInvalido) {
      toast.error("Capacidad máxima: 3 adultos o 2 adultos y 2 niños. En caso contrario, no se podrá arrendar.");
      return;
    }

    if (!acceptTerms) {
      toast.error("Debes aceptar los términos y condiciones para continuar.");
      return;
    }

    if (!acceptPrivacy) {
      toast.error("Debes aceptar la política de privacidad para continuar.");
      return;
    }

    if (!nights) {
      toast.error("Selecciona al menos una noche.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Completa todos los campos.");
      return;
    }

    // Validación simple para el número (asegurar que empiece con 9 o tenga formato correcto)
    const rawPhone = form.phone.trim().replace(/[^0-9]/g, "");
    const formattedPhone = `+56${rawPhone}`;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Correo no válido.");
      return;
    }

    setSending(true);
    const dates = [...selected].sort();
    const result = await createReservation({
      name: form.name.trim(),
      phone: formattedPhone, // Guarda con el +56 incluido
      email: form.email.trim(),
      dates,
      total,
      firewood,
      adults,
      children: childrenCount,
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

    // --- 1. ENVÍO DE CORREO AUTOMÁTICO AL CLIENTE (EmailJS) ---
    try {
      await emailjs.send(
        'service_9gb8cmf',
        'template_m4c2g45',
        {
          client_name: form.name.trim(),
          client_email: form.email.trim(),
          dates: dates.map(formatDay).join(", "),
          passengers: `${adults} adulto(s), ${childrenCount} niño(s)`,
          total: formatCLP(total),
        },
        'ePdaz67F06AKh8qyp'
      );
    } catch (err) {
      console.error("Error al enviar correo automático al cliente:", err);
    }

    // --- 2. ENVÍO DE NOTIFICACIÓN AUTOMÁTICA AL DUEÑO (EmailJS) ---
    try {
      await emailjs.send(
        'service_9gb8cmf',
        'template_syzww2u',
        {
          client_name: form.name.trim(),
          client_phone: formattedPhone,
          passengers: `${adults} adulto(s), ${childrenCount} niño(s)`,
          dates: dates.map(formatDay).join(", "),
          total: formatCLP(total),
        },
        'ePdaz67F06AKh8qyp'
      );
    } catch (err) {
      console.error("Error al enviar notificación al dueño:", err);
    }

    setSelected([]);
    setForm({ name: "", phone: "", email: "" });
    setAdults(1);
    setChildrenCount(0);
    setAcceptTerms(false);
    setAcceptPrivacy(false);
    setDone(true);
    toast.success("¡Reserva solicitada con éxito! Revisa tu correo.");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img 
              src="/logo.jpg" 
              alt="Logotipo Cabaña y tinaja MH" 
              className="h-10 w-10 shrink-0 rounded-full sm:h-12 sm:w-12 object-cover" 
            />
            <div className="min-w-0">
              <p className="text-hero truncate text-base leading-tight">Cabaña y tinaja MH</p>
              <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                Cabaña · Tinaja · Naturaleza
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-10 w-full">
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
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Valores por noche. Capacidad máxima: 3 adultos o 2 adultos y 2 niños (en caso contrario, no se podrá arrendar la cabaña). Para 3 adultos se aplica un cargo adicional de $10.000. Check-in {CHECK_IN} hrs · Check-out {CHECK_OUT} hrs.
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
                  al llegar a la cabaña; no se cobra en el pago online de la reserva.
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

            {/* Selectores de cantidad de pasajeros */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Adultos (máx. 3)</label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
                >
                  <option value={1}>1 adulto</option>
                  <option value={2}>2 adultos</option>
                  <option value={3}>3 adultos (+$10.000)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Niños (máx. 2)</label>
                <select
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
                >
                  <option value={0}>0 niños</option>
                  <option value={1}>1 niño</option>
                  <option value={2}>2 niños</option>
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <Field
                icon={<User className="h-4 w-4" />}
                placeholder="Nombre y apellido"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />

              {/* Campo de teléfono adaptado con +56 fijo */}
              <div>
                <label className="flex items-center gap-3 rounded-xl border border-input bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
                  <span className="shrink-0 text-muted-foreground"><Phone className="h-4 w-4" /></span>
                  <span className="text-sm font-medium text-muted-foreground select-none">+56</span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    placeholder="912345678"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, "") })}
                    className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm text-foreground"
                  />
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground pl-1">
                  Ingresa tu número sin el +56 (pon solo desde el 9, ej: 912345678)
                </p>
              </div>

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

            {/* Sección de Términos y Condiciones */}
            <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm">
              <div className="font-bold text-red-600 dark:text-red-400 text-base mb-1">
                ¡IMPORTANTE LEER!
              </div>
              <div className="font-medium text-foreground mb-2">Términos y condiciones de la estadía:</div>
              <ul className="list-disc pl-4 space-y-2 text-foreground mb-4 max-h-48 overflow-y-auto">
                <li><strong>No se hace devolución de dinero</strong> por cancelación de estadía; no obstante, se puede reagendar sin problemas avisando con 10 días de anticipación.</li>
                <li>Al transferir o confirmar, <strong>usted está aceptando estas condiciones</strong>.</li>
                <li><strong>Prohibido traer animales.</strong></li>
                <li><strong>Prohibido música a un volumen alto</strong> después de las 22:00 hrs.</li>
                <li><strong>Prohibido ingreso de personas no alojadas</strong> a la cabaña.</li>
                <li><strong>Prohibido arrojar comida o alcohol</strong> dentro de la tinaja.</li>
                <li><strong>Prohibido llevarse algún artículo</strong> de la cabaña.</li>
                <li><strong>Prohibido orinar</strong> dentro de la tinaja.</li>
                <li><strong>Prohibido fumar</strong> al interior de la cabaña.</li>
                <li>Hacer <strong>buen uso del agua</strong>.</li>
              </ul>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>Acepto los términos y condiciones</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>He leído y acepto la <a href="#politica-privacidad" className="text-primary underline">Política de Privacidad</a></span>
                </label>
              </div>
            </div>

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
              {adults === 3 && (
                <div className="flex justify-between text-xs text-primary mt-2">
                  <span>Adicional 3° adulto</span>
                  <span>{formatCLP(10000)}</span>
                </div>
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
              <div className="mt-4 rounded-xl border border-primary/40 bg-secondary p-4 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">
                  ¡Reserva solicitada con éxito! Te hemos enviado un correo con las instrucciones de transferencia.
                </p>
                <a
                  href={`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(`Hola, acabo de solicitar una reserva en Cabaña y tinaja MH. ¡Quedo atento!`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
                >
                  <MessageCircle className="h-4 w-4" /> Avisar al dueño por WhatsApp (Opcional)
                </a>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Nota: Mientras no realices la transferencia, el día seguirá disponible para otros usuarios.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* --- SECCIÓN DE POLÍTICA DE PRIVACIDAD AL FINAL --- */}
        <section id="politica-privacidad" className="mt-16 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8 scroll-mt-6">
          <h2 className="flex items-center gap-2 text-hero text-2xl mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Política de Privacidad
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            <strong>Última actualización:</strong> 19 de septiembre de 2026
          </p>

          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Nos tomamos muy en serio la protección de tus datos personales. Esta Política de Privacidad explica qué información recopilamos a través de nuestra plataforma web en el agendamiento de cabañas y cómo la utilizamos.
            </p>

            <div>
              <h3 className="font-medium text-foreground text-base mb-1">1. ¿Qué datos recopilamos?</h3>
              <p>Recopilamos únicamente los datos estrictamente necesarios según el servicio que estés utilizando:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li><strong>Para el Agendamiento de Cabañas:</strong> Nombre, Apellido, Número de Teléfono y Correo Electrónico.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-foreground text-base mb-1">2. ¿Para qué usamos tus datos?</h3>
              <p>La información recopilada se utiliza de manera exclusiva para los fines operativos de nuestros servicios:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li><strong>Cabañas:</strong> Gestionar, coordinar y confirmar las reservas de alojamiento, así como contactarte en caso de modificaciones o dudas sobre tu estadía.</li>
              </ul>
              <p className="mt-2">
                Tus datos <strong>nunca</strong> serán vendidos, arrendados ni compartidos con terceros con fines comerciales o publicitarios ajenos a nosotros.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground text-base mb-1">3. Almacenamiento y Seguridad</h3>
              <p>
                Tus datos son almacenados de forma segura en bases de datos protegidas y cifradas (utilizando la infraestructura de Supabase). Aplicamos medidas técnicas para resguardar la información frente a accesos no autorizados o filtraciones.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground text-base mb-1">4. Tus Derechos</h3>
              <p>Como usuario y dueño de tus datos, puedes en cualquier momento:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Solicitar saber qué información tenemos registrada sobre ti.</li>
                <li>Pedir la modificación de tus datos si hay un error.</li>
                <li>Solicitar la eliminación total de tus registros de nuestra base de datos una vez que ya no utilices el servicio.</li>
              </ul>
              <p className="mt-2">
                Para ejercer cualquiera de estos derechos, solo debes escribirnos a nuestro correo de contacto: <strong className="text-foreground">cabanamh27@gmail.com</strong>.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground text-base mb-1">5. Consentimiento</h3>
              <p>
                Al completar y enviar los formularios de reserva en nuestra web, declaras que has leído y aceptas los términos de esta Política de Privacidad.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER INSTITUCIONAL --- */}
      <footer className="mt-16 border-t border-border bg-card/50 py-8 px-4 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl space-y-3">
          <p className="font-medium text-foreground">
            {BUSINESS_NAME} · Todos los derechos reservados © 2026
          </p>
          <p>
            Check-in: <strong className="text-foreground">{CHECK_IN} hrs</strong> · Check-out: <strong className="text-foreground">{CHECK_OUT} hrs</strong>
          </p>
          <p className="text-[11px] opacity-80 max-w-xl mx-auto">
            Plataforma oficial de reservas. Cabaña privada con tinaja de hidromasajes, rodeada de naturaleza.
          </p>
        </div>
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
        className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm text-foreground"
      />
    </label>
  );
}