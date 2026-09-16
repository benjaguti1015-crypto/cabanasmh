import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  Flame,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  PartyPopper,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  TrendingUp,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";

import logo from "../assets/logo.jpg";
import { BookingCalendar } from "@/components/BookingCalendar";
import {
  addExpense,
  checkCloudStatus,
  deleteReservation,
  removeExpense,
  removeOfferDays,
  saveRates,
  setBlockedDays,
  setHolidayDays,
  setOfferDays,
  updateReservationDates,
  updateReservationStatus,
  useCabinData,
  type CabinData,
} from "@/lib/cloud";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BUSINESS_NAME,
  CHECK_IN,
  CHECK_OUT,
  FIREWOOD_PRICE,
  OWNER_WHATSAPP,
  expensesInRange,
  formatCLP,
  formatDay,
  formatDayLong,
  incomeInRange,
  isAdminLogged,
  periodRange,
  setAdminLogged,
  toKey,
  totalForDays,
  weekendPackage,
  type Expense,
  type Reservation,
} from "@/lib/booking";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel de administración — Cabaña y tinaja MH" },
      { name: "description", content: "Gestiona reservas y disponibilidad de la cabaña." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Panel de administración — Cabaña y tinaja MH" },
      { property: "og:description", content: "Gestiona reservas y disponibilidad de la cabaña." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminView,
});

function AdminView() {
  const [logged, setLogged] = useState(false);
  useEffect(() => setLogged(isAdminLogged()), []);
  return logged ? <Dashboard onLogout={() => setLogged(false)} /> : <Login onLogin={() => setLogged(true)} />;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setAdminLogged(true);
      onLogin();
    } else {
      toast.error("Credenciales incorrectas.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <img src={logo} alt="Logotipo MH" className="mx-auto h-16 w-16 rounded-full object-cover" />
        <h1 className="mt-4 text-center text-hero text-2xl">Acceso administrador</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">{BUSINESS_NAME}</p>

        <div className="mt-6 space-y-3">
          <input
            type="email"
            required
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm text-foreground"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm text-foreground"
          />
        </div>

        <button
          type="submit"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:shadow-lift"
        >
          <Lock className="h-4 w-4" /> Ingresar
        </button>

        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:underline">
          Volver al sitio
        </Link>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { data, loading, reload } = useCabinData();
  const { reservations, blocked, offers, rates, holidays } = data;

  const [weekdayInput, setWeekdayInput] = useState("");
  const [weekendInput, setWeekendInput] = useState("");
  const [holidayInput, setHolidayInput] = useState("");
  const [ratesTouched, setRatesTouched] = useState(false);
  const [mode, setMode] = useState<"block" | "offer" | "holiday">("block");
  const [offerInput, setOfferInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState<string[]>([]);

  useEffect(() => {
    if (ratesTouched) return;
    setWeekdayInput(String(rates.weekday));
    setWeekendInput(String(rates.weekend));
    setHolidayInput(String(rates.holiday));
  }, [rates, ratesTouched]);

  const booked = reservations.flatMap((r) => r.dates);
  const income = reservations.reduce((sum, r) => sum + r.total, 0);
  const editing = reservations.find((r) => r.id === editingId) ?? null;
  const editTotal = totalForDays(editDates, rates, offers, holidays);

  const savePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const weekday = Number(weekdayInput);
    const weekend = Number(weekendInput);
    const holiday = Number(holidayInput);
    if (
      !Number.isFinite(weekday) ||
      weekday <= 0 ||
      !Number.isFinite(weekend) ||
      weekend <= 0 ||
      !Number.isFinite(holiday) ||
      holiday <= 0
    ) {
      toast.error("Ingresa valores por noche mayores a cero.");
      return;
    }
    const ok = await saveRates({
      weekday: Math.round(weekday),
      weekend: Math.round(weekend),
      holiday: Math.round(holiday),
    });
    if (!ok) {
      toast.error("No pudimos guardar las tarifas.");
      return;
    }
    setRatesTouched(false);
    await reload();
    toast.success("Tarifas actualizadas para todos los dispositivos.");
  };

  const startEdit = (r: Reservation) => {
    setEditingId(r.id);
    setEditDates([...r.dates].sort());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDates([]);
  };

  /** Toca días para mover la reserva; viernes y sábado se mueven juntos. */
  const toggleEditDay = (day: string) => {
    const group = weekendPackage(day);
    const takenByOthers = reservations
      .filter((r) => r.id !== editingId)
      .flatMap((r) => r.dates);
    setEditDates((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => !group.includes(d)).sort();
      }
      const free = group.filter((d) => !takenByOthers.includes(d) && !blocked.includes(d));
      if (free.length !== group.length) {
        toast.error("Ese fin de semana no está completamente libre.");
        return prev;
      }
      return Array.from(new Set([...prev, ...group])).sort();
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editDates.length) {
      toast.error("Selecciona al menos una noche.");
      return;
    }
    const ok = await updateReservationDates(editing.id, [...editDates].sort(), editTotal);
    if (!ok) {
      toast.error("No pudimos actualizar la reserva.");
      return;
    }
    cancelEdit();
    await reload();
    toast.success("Reserva actualizada con las nuevas fechas.");
  };

  const onDayClick = async (day: string) => {
    if (mode === "holiday") {
      const isHoliday = holidays.includes(day);
      await setHolidayDays([day], !isHoliday);
      await reload();
      toast.success(
        isHoliday
          ? "Día ya no es feriado."
          : `Día marcado como feriado a ${formatCLP(rates.holiday)}.`,
      );
      return;
    }

    if (booked.includes(day)) {
      toast.error("Ese día tiene una reserva activa.");
      return;
    }

    if (mode === "offer") {
      if (offers[day] !== undefined) {
        await removeOfferDays([day]);
        await reload();
        toast.success("Oferta quitada de ese día.");
        return;
      }
      const value = Number(offerInput);
      if (!Number.isFinite(value) || value <= 0) {
        toast.error("Escribe primero el precio de oferta.");
        return;
      }
      await setOfferDays([day], value);
      await reload();
      toast.success(`Día en oferta a ${formatCLP(Math.round(value))}.`);
      return;
    }

    const group = weekendPackage(day);
    const willBlock = !blocked.includes(day);
    const target = willBlock ? group.filter((d) => !booked.includes(d)) : group;
    await setBlockedDays(target, willBlock);
    await reload();
    toast.success(willBlock ? "Día marcado como ocupado." : "Día habilitado.");
  };

  const del = async (id: string) => {
    await deleteReservation(id);
    await reload();
    toast.success("Reserva eliminada.");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logotipo MH" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-hero truncate text-base leading-tight sm:text-lg">Panel de administración</p>
              <p className="truncate text-xs text-muted-foreground">{BUSINESS_NAME}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setAdminLogged(false);
              onLogout();
            }}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-4"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-5 sm:py-8">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wifi className="h-3.5 w-3.5 text-primary" />
          {loading ? "Cargando datos de la nube…" : "Datos sincronizados en tiempo real"}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Reservas" value={String(reservations.length)} />
          <Stat label="Noches vendidas" value={String(booked.length)} />
          <Stat label="Ingresos" value={formatCLP(income)} />
        </div>

        <Finance reservations={reservations} expenses={data.expenses} reload={reload} />

        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <h2 className="flex items-center gap-2 text-hero text-xl">
            <Tag className="h-5 w-5" /> Tarifas por noche
          </h2>
          <form onSubmit={savePrice} className="mt-4 flex flex-wrap items-end gap-4">
            <label className="text-xs text-muted-foreground">
              Domingo a jueves
              <input
                value={weekdayInput}
                onChange={(e) => {
                  setRatesTouched(true);
                  setWeekdayInput(e.target.value.replace(/[^0-9]/g, ""));
                }}
                inputMode="numeric"
                placeholder="60000"
                className="mt-1 block w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-40 sm:text-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Viernes y sábado
              <input
                value={weekendInput}
                onChange={(e) => {
                  setRatesTouched(true);
                  setWeekendInput(e.target.value.replace(/[^0-9]/g, ""));
                }}
                inputMode="numeric"
                placeholder="70000"
                className="mt-1 block w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-40 sm:text-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Feriados y festivos
              <input
                value={holidayInput}
                onChange={(e) => {
                  setRatesTouched(true);
                  setHolidayInput(e.target.value.replace(/[^0-9]/g, ""));
                }}
                inputMode="numeric"
                placeholder="75000"
                className="mt-1 block w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-40 sm:text-sm"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:shadow-lift sm:w-auto"
            >
              Guardar tarifas
            </button>
            <span className="text-xs text-muted-foreground">
              Actual: {formatCLP(rates.weekday)} · fin de semana {formatCLP(rates.weekend)} ·
              feriados {formatCLP(rates.holiday)}
            </span>
            <p className="w-full text-xs text-muted-foreground">
              Adicional obligatorio: 1 saco de leña {formatCLP(FIREWOOD_PRICE)}, se cancela en
              efectivo al llegar al lugar (no se incluye en el total de la reserva).
            </p>
          </form>
        </section>

        {editing && (
          <section className="rounded-2xl border border-primary/40 bg-card p-4 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-hero text-xl">
                <Pencil className="h-5 w-5" /> Mover reserva de {editing.name}
              </h2>
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Toca los días para quitar o agregar noches. Viernes y sábado se mueven juntos.
            </p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <BookingCalendar
                occupied={[
                  ...reservations.filter((r) => r.id !== editing.id).flatMap((r) => r.dates),
                  ...blocked,
                ]}
                selected={editDates}
                onSelect={toggleEditDay}
                offers={offers}
                holidays={holidays}
                holidayRate={rates.holiday}
                allowPast
              />
              <div className="rounded-xl bg-secondary p-4 text-sm">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Nuevas fechas
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {editDates.length === 0 ? (
                    <li>Sin noches seleccionadas.</li>
                  ) : (
                    editDates.map((d) => <li key={d}>{formatDayLong(d)}</li>)
                  )}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-medium">Nuevo total</span>
                  <span className="text-hero text-2xl">{formatCLP(editTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all hover:shadow-lift"
                >
                  <Check className="h-4 w-4" /> Guardar cambios
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-hero text-xl">
              <CalendarDays className="h-5 w-5" /> Disponibilidad y ofertas
            </h2>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex rounded-full border border-border p-1">
                {([
                  ["block", "Ocupar días"],
                  ["offer", "Marcar oferta"],
                  ["holiday", "Marcar feriado"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={[
                      "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                      mode === value
                        ? value === "holiday"
                          ? "bg-amber-500 text-white"
                          : "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {value === "holiday" ? (
                      <span className="inline-flex items-center gap-1">
                        <PartyPopper className="h-3 w-3" /> {label}
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                ))}
              </div>
              {mode === "offer" && (
                <input
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="Precio de oferta"
                  className="w-40 rounded-xl border border-input bg-background px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm text-foreground"
                />
              )}
            </div>

            <BookingCalendar
              occupied={[...booked, ...blocked]}
              selected={[]}
              onSelect={onDayClick}
              offers={offers}
              holidays={holidays}
              holidayRate={rates.holiday}
              allowOccupied
              allowPast
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {mode === "block"
                ? "Toca un día para marcarlo como ocupado o liberarlo. Los días con reserva no se pueden bloquear."
                : mode === "offer"
                  ? "Escribe el precio de oferta y toca los días que quieras rebajar. Toca un día en oferta para quitarla."
                  : `Toca un día para marcarlo o desmarcarlo como feriado (${formatCLP(rates.holiday)} por noche). Los feriados se ven en ámbar en el calendario.`}
            </p>
            {Object.keys(offers).length > 0 && (
              <div className="mt-4 rounded-xl border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Días en oferta
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(offers)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, value]) => (
                      <li key={day} className="flex items-center justify-between gap-3">
                        <span>{formatDay(day)}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-primary">{formatCLP(value)}</span>
                          <button
                            type="button"
                            aria-label="Quitar oferta"
                            onClick={async () => {
                              await removeOfferDays([day]);
                              await reload();
                              toast.success("Oferta quitada.");
                            }}
                            className="text-destructive transition-opacity hover:opacity-70"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {holidays.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-amber-900 dark:text-amber-100">
                  <PartyPopper className="h-3.5 w-3.5" /> Días feriados
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {holidays.map((day) => (
                    <li key={day}>
                      <button
                        type="button"
                        onClick={async () => {
                          await setHolidayDays([day], false);
                          await reload();
                          toast.success("Feriado quitado.");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-50 dark:hover:bg-amber-900/60"
                        title="Clic para quitar feriado"
                      >
                        {formatDay(day)}
                        <X className="h-3 w-3 opacity-60" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-hero text-xl">Reservas agendadas</h2>
            {reservations.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aún no hay reservas registradas.
              </p>
            ) : (
              <ul className="space-y-3">
                {reservations.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{r.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {r.phone}
                        </p>
                        <p className="mt-1 flex items-center gap-2 break-all text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" /> {r.email}
                        </p>
                        <p className="mt-1 text-xs font-medium text-primary">
                          👥 Pasajeros: {(r as any).adults ?? 1} adulto{((r as any).adults ?? 1) > 1 ? "s" : ""} {(r as any).children !== undefined ? `· ${(r as any).children} niño${(r as any).children > 1 ? "s" : ""}` : ""}
                        </p>
                        <p
                          className={[
                            "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                            r.firewood
                              ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300/80 dark:bg-orange-950/50 dark:text-orange-100 dark:ring-orange-700"
                              : "bg-muted text-muted-foreground",
                          ].join(" ")}
                        >
                          <Flame className="h-3 w-3 shrink-0" />
                          {r.firewood
                            ? `Saco de leña · ${formatCLP(FIREWOOD_PRICE)} en efectivo al llegar`
                            : "Sin leña adicional"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-hero text-xl">{formatCLP(r.total)}</p>
                        <p className="text-xs text-muted-foreground">{r.nights} noche(s)</p>
                      </div>
                    </div>
                    <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      {r.dates.map(formatDay).join(" · ")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Pago:</span>
                        <select
                          className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                          value={(r as any).status || "pendiente"}
                          onChange={async (e) => {
                            const newStatus = e.target.value as "pendiente" | "pagado";
                            console.log("Intentando actualizar reserva ID:", r.id, "a estado:", newStatus);
                            const ok = await updateReservationStatus(r.id, newStatus);
                            if (ok) {
                              toast.success(`Estado actualizado a: ${newStatus}`);
                              await reload();
                            } else {
                              console.error("Fallo al actualizar en cloud. Revisa Supabase.");
                              toast.error("No se pudo actualizar el estado de pago.");
                            }
                          }}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="pagado">Pagado</option>
                        </select>
                      </div>

                      <a
                        href={`https://api.whatsapp.com/send?phone=${r.phone.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(`Hola ${r.name}, te escribimos de Cabaña y tinaja MH para confirmar los detalles de tu reserva.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp
                      </a>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <button
                        onClick={() => startEdit(r)}
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> Editar fechas
                      </button>
                      <button
                        onClick={() => del(r.id)}
                        className="flex items-center gap-2 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Eliminar reserva
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SystemStatus data={data} loading={loading} />
      </main>
    </div>
  );
}

function SystemStatus({ data, loading }: { data: CabinData; loading: boolean }) {
  const [cloud, setCloud] = useState<{ ok: boolean; ms: number; message: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const run = async () => {
    setChecking(true);
    setCloud(await checkCloudStatus());
    setChecking(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="flex items-center gap-2 text-hero text-xl">
        <Activity className="h-5 w-5" /> Estado del sistema
      </h2>
      <ul className="mt-4 space-y-2 text-sm">
        <Row
          label="Sincronización en la nube"
          value={loading ? "Conectando…" : `Activa · ${data.reservations.length} reservas`}
          ok={!loading}
        />
        <Row
          label="WhatsApp del dueño"
          value={`+${OWNER_WHATSAPP}`}
          ok
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
        <Row
          label="Correo con copia al administrador"
          value={ADMIN_EMAIL}
          ok
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <Row label="Horarios" value={`Check-in ${CHECK_IN} · Check-out ${CHECK_OUT}`} ok />
        {cloud && (
          <Row
            label="Última prueba de conexión"
            value={`${cloud.message} (${cloud.ms} ms)`}
            ok={cloud.ok}
          />
        )}
      </ul>
      <button
        type="button"
        onClick={run}
        disabled={checking}
        className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60 sm:w-auto"
      >
        {checking ? "Probando…" : "Probar conexión"}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Al confirmar una reserva se abre WhatsApp con el aviso al dueño y el correo al cliente con
        copia a {ADMIN_EMAIL}.
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  ok,
  icon,
}: {
  label: string;
  value: string;
  ok: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon} {label}
      </span>
      <span className={ok ? "text-primary" : "text-destructive"}>{value}</span>
    </li>
  );
}

function Finance({
  reservations,
  expenses,
  reload,
}: {
  reservations: Reservation[];
  expenses: Expense[];
  reload: () => Promise<unknown>;
}) {
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");

  const range = periodRange(period);
  const income = incomeInRange(reservations, range);
  const spent = expensesInRange(expenses, range);
  const profit = income - spent;
  const periodExpenses = expenses
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .slice()
    .reverse();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (concept.trim().length < 2) {
      toast.error("Escribe un concepto válido.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Ingresa un monto mayor a cero.");
      return;
    }
    const ok = await addExpense(concept.trim().slice(0, 60), Math.round(value), toKey(new Date()));
    if (!ok) {
      toast.error("No pudimos guardar el gasto.");
      return;
    }
    setConcept("");
    setAmount("");
    await reload();
    toast.success("Gasto registrado.");
  };

  const del = async (id: string) => {
    await removeExpense(id);
    await reload();
    toast.success("Gasto eliminado.");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-hero text-xl">
          <TrendingUp className="h-5 w-5" /> Finanzas
        </h2>
        <div className="flex rounded-full border border-border p-1">
          {([
            ["week", "Semanal"],
            ["month", "Mensual"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={[
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                period === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Período: {formatDay(range.start)} — {formatDay(range.end)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Ingresos del período" value={formatCLP(income)} />
        <Stat label="Gastos del período" value={formatCLP(spent)} />
        <Stat label="Utilidad estimada" value={formatCLP(profit)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={add} className="space-y-3">
          <h3 className="text-sm font-medium">Registrar gasto</h3>
          <input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            maxLength={60}
            placeholder="Concepto (ej: mantención tinaja)"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm text-foreground"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Monto en CLP"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm text-foreground"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all hover:shadow-lift"
          >
            <Plus className="h-4 w-4" /> Agregar gasto
          </button>
        </form>

        <div>
          <h3 className="mb-3 text-sm font-medium">Gastos del período</h3>
          {periodExpenses.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Sin gastos registrados en este período.
            </p>
          ) : (
            <ul className="space-y-2">
              {periodExpenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.concept}</p>
                    <p className="text-xs text-muted-foreground">{formatDay(e.date)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm">{formatCLP(e.amount)}</span>
                    <button
                      type="button"
                      aria-label="Eliminar gasto"
                      onClick={() => del(e.id)}
                      className="text-destructive transition-opacity hover:opacity-70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-hero text-2xl">{value}</p>
    </div>
  );
}