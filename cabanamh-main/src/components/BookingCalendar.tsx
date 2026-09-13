import { ChevronLeft, ChevronRight, PartyPopper, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatCLP, toKey } from "@/lib/booking";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

type Props = {
  occupied: string[];
  selected: string[];
  onSelect: (day: string) => void;
  /** Permite seleccionar días ocupados (modo administrador). */
  allowOccupied?: boolean;
  /** Permite seleccionar días pasados (modo administrador). */
  allowPast?: boolean;
  /** Precios especiales por día: { "2026-09-10": 39000 } */
  offers?: Record<string, number>;
  /** Días marcados como feriado o festivo (tarifa especial). */
  holidays?: string[];
  /** Tarifa de feriado (solo visualización en el calendario). */
  holidayRate?: number;
};

export function BookingCalendar({
  occupied,
  selected,
  onSelect,
  allowOccupied = false,
  allowPast = false,
  offers = {},
  holidays = [],
  holidayRate,
}: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const todayKey = toKey(today);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-display text-lg capitalize tracking-wide text-foreground">
          {cursor.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const key = toKey(new Date(year, month, day));
          const isOccupied = occupied.includes(key);
          const isPast = key < todayKey;
          const isSelected = selected.includes(key);
          const disabled = (isOccupied && !allowOccupied) || (isPast && !allowPast);
          const offer = offers[key];
          const hasOffer = offer !== undefined && !isOccupied;
          const isHoliday = holidays.includes(key);

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(key)}
              title={
                hasOffer
                  ? `Oferta: ${formatCLP(offer)} por noche`
                  : isHoliday
                    ? holidayRate
                      ? `Feriado · ${formatCLP(holidayRate)} por noche`
                      : "Feriado o festivo · tarifa especial"
                    : undefined
              }
              className={[
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : isOccupied
                    ? "bg-destructive/10 text-destructive line-through"
                    : disabled
                      ? "text-muted-foreground/40"
                      : hasOffer
                        ? "bg-accent/60 text-accent-foreground ring-1 ring-primary/40 hover:bg-accent"
                        : isHoliday
                          ? "bg-amber-100 text-amber-950 ring-2 ring-amber-400/70 hover:bg-amber-200/90 dark:bg-amber-950/40 dark:text-amber-50 dark:ring-amber-500/50"
                          : "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <span className="leading-none">{day}</span>
              {hasOffer && (
                <>
                  <Sparkles
                    className={[
                      "absolute right-1 top-1 h-2.5 w-2.5",
                      isSelected ? "text-primary-foreground/80" : "text-primary/70",
                    ].join(" ")}
                  />
                  <span
                    className={[
                      "mt-0.5 text-[9px] font-normal tabular-nums leading-none",
                      isSelected ? "text-primary-foreground/85" : "text-primary/80",
                    ].join(" ")}
                  >
                    {Math.round(offer / 1000)}k
                  </span>
                </>
              )}
              {isHoliday && !hasOffer && !isSelected && (
                <>
                  <PartyPopper
                    className={[
                      "absolute right-0.5 top-0.5 h-2.5 w-2.5",
                      isOccupied ? "text-amber-700/80" : "text-amber-700 dark:text-amber-300",
                    ].join(" ")}
                  />
                  {holidayRate !== undefined && holidayRate > 0 && (
                    <span
                      className={[
                        "mt-0.5 text-[9px] font-semibold tabular-nums leading-none",
                        isOccupied ? "text-amber-800/70" : "text-amber-800 dark:text-amber-200",
                      ].join(" ")}
                    >
                      {Math.round(holidayRate / 1000)}k
                    </span>
                  )}
                </>
              )}
              {isHoliday && isOccupied && hasOffer && (
                <PartyPopper className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-amber-700/80" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-secondary" /> Disponible
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-destructive/30" /> Ocupado
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-primary" /> Seleccionado
        </span>
        <span className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary/70" /> En oferta
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-200 ring-1 ring-amber-500/60" /> Feriado
        </span>
      </div>
    </div>
  );
}
