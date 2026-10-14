"use client";

import { useEffect, useState } from "react";
import { comBasePath } from "@/lib/base-path";
import { CourseAssessments } from "./CourseAssessments";
import { CourseGroups } from "./CourseGroups";

/**
 * "Oferta 2026.2": the block of the course page that holds what belongs to
 * the course's offer for the platform's active period — its assessments and
 * its groups. The active period is chosen in "Configurações gerais"; with
 * none active, or none for this course, the block is not rendered.
 *
 * Looked up in the browser, not at build time, so the static course page
 * follows a change of the active offer without being rebuilt.
 */
export function CourseOffer({ courseId }: { courseId: string | number }) {
  const [offer, setOffer] = useState<{
    id: string | number;
    period: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settingsRes = await fetch(
          comBasePath("/api/globals/site-settings?depth=1"),
        );
        if (!settingsRes.ok) return;
        const period: string | undefined = (await settingsRes.json()).activeTerm
          ?.period;
        if (!period) return;

        const res = await fetch(
          comBasePath(
            `/api/offers?where[course][equals]=${courseId}&where[period][equals]=${encodeURIComponent(period)}&depth=0&limit=1&select[period]=true`,
          ),
        );
        if (!res.ok) return;
        const found = (await res.json()).docs?.[0];
        if (!cancelled && found) {
          setOffer({ id: found.id, period: found.period });
        }
      } catch {
        // No offer block rather than a broken one.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (!offer) return null;

  return (
    <section aria-labelledby="course-offer-heading" className="space-y-4">
      <h2
        id="course-offer-heading"
        className="font-serif text-xl font-semibold tracking-tight"
      >
        Oferta {offer.period}
      </h2>
      <CourseAssessments offerId={offer.id} />
      <CourseGroups offerId={offer.id} />
    </section>
  );
}
