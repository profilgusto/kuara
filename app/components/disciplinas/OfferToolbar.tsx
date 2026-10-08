"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { offerLabel, type OfferOption } from "@/lib/offer-period";
import { CreateOfferDialog } from "./CreateOfferDialog";

/**
 * Bar under the course header on the offers page, in the same style as the
 * site's top bar. Holds the tools that act on the course's offers: the
 * dropdown choosing which one is on screen, and the button creating a new one.
 *
 * The choice lives in the URL (`?oferta=2026.2`), so the server renders the
 * page for that offer and the address can be shared or reloaded. `offers`
 * arrives sorted, most recent first.
 */
export function OfferToolbar({
  courseId,
  offers,
  activePeriod,
}: {
  courseId: string | number;
  offers: OfferOption[];
  activePeriod: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function select(period: string) {
    startTransition(() => {
      router.replace(`${pathname}?oferta=${encodeURIComponent(period)}`, {
        scroll: false,
      });
    });
  }

  // A new offer becomes the one on screen. `refresh` is what brings it into
  // the dropdown: `replace` alone may reuse the list already rendered.
  function showCreated(period: string) {
    select(period);
    router.refresh();
  }

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas da oferta"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur"
    >
      <label
        htmlFor="oferta-ativa"
        className="flex items-center gap-1.5 font-medium text-foreground"
      >
        <CalendarRange className="h-4 w-4 text-primary" />
        Oferta
      </label>

      {offers.length === 0 || activePeriod === null ? (
        <span className="italic text-muted-foreground/70">
          Nenhuma oferta cadastrada
        </span>
      ) : (
        <select
          id="oferta-ativa"
          value={activePeriod}
          onChange={(event) => select(event.target.value)}
          disabled={pending}
          className="rounded-md border border-border bg-input px-2 py-1 font-mono text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
        >
          {offers.map((offer) => (
            <option key={offer.id} value={offer.period}>
              {offerLabel(offer)}
            </option>
          ))}
        </select>
      )}

      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}

      <CreateOfferDialog
        courseId={courseId}
        existingPeriods={offers.map((offer) => offer.period)}
        onCreated={showCreated}
      />
    </div>
  );
}
