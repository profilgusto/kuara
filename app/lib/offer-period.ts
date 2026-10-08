/**
 * lib/offer-period.ts — ordering and choosing a course's offers.
 *
 * An offer is identified by its period, written YEAR.SEMESTER ("2026.2").
 * The field is free text in Payload, so anything that does not fit the
 * pattern is tolerated and simply sorts after the periods that do.
 */

export interface OfferOption {
  id: string | number;
  period: string;
  status?: string | null;
}

/** "2026.2" → { year: 2026, semester: 2 }; null when it is not a period. */
export function parsePeriod(
  period: string,
): { year: number; semester: number } | null {
  const match = /^(\d{4})\.(\d{1,2})$/.exec(period.trim());
  if (!match) return null;
  return { year: Number(match[1]), semester: Number(match[2]) };
}

/**
 * Sort comparator: most recent period first. Compared as numbers, so 2026.10
 * comes after 2026.9 rather than between 2026.1 and 2026.2.
 */
export function comparePeriodsLatestFirst(a: string, b: string): number {
  const pa = parsePeriod(a);
  const pb = parsePeriod(b);
  if (pa && pb) {
    return pb.year - pa.year || pb.semester - pa.semester;
  }
  if (pa) return -1;
  if (pb) return 1;
  return b.localeCompare(a);
}

export function sortOffersLatestFirst<T extends OfferOption>(offers: T[]): T[] {
  return [...offers].sort((a, b) =>
    comparePeriodsLatestFirst(a.period, b.period),
  );
}

/**
 * The offer to show: the one whose period was asked for, or the most recent
 * when none was asked for or the one asked for does not exist. Null only for
 * a course with no offers.
 */
export function pickActiveOffer<T extends OfferOption>(
  offers: T[],
  requestedPeriod?: string | null,
): T | null {
  const sorted = sortOffersLatestFirst(offers);
  const wanted = requestedPeriod?.trim();
  return (
    (wanted && sorted.find((offer) => offer.period.trim() === wanted)) ||
    sorted[0] ||
    null
  );
}

/** What the dropdown shows for an offer. */
export function offerLabel(offer: OfferOption): string {
  return offer.status === "archived"
    ? `${offer.period} (arquivada)`
    : offer.period;
}

/** Years the "create offer" box accepts. */
export const MIN_OFFER_YEAR = 2000;
export const MAX_OFFER_YEAR = 2100;

/** What the year box keeps of what was typed: digits only, four at most. */
export function sanitizeYearInput(text: string): string {
  return text.replace(/\D/g, "").slice(0, 4);
}

/**
 * What the semester box keeps of what was typed: a single 1 or 2. The last
 * valid character wins, so typing "2" over a "1" replaces it.
 */
export function sanitizeSemesterInput(text: string): string {
  const valid = text.replace(/[^12]/g, "");
  return valid.slice(-1);
}

export type PeriodResult =
  | { ok: true; period: string }
  | { ok: false; error: string };

/**
 * Builds "YEAR.SEMESTER" from the two boxes of the "create offer" dialog,
 * refusing anything outside the pattern or a period the course already has.
 */
export function buildPeriod(
  yearText: string,
  semesterText: string,
  existingPeriods: string[] = [],
): PeriodResult {
  const year = yearText.trim();
  const semester = semesterText.trim();

  if (!/^\d{4}$/.test(year)) {
    return { ok: false, error: "Informe o ano com quatro dígitos." };
  }
  if (Number(year) < MIN_OFFER_YEAR || Number(year) > MAX_OFFER_YEAR) {
    return {
      ok: false,
      error: `O ano deve estar entre ${MIN_OFFER_YEAR} e ${MAX_OFFER_YEAR}.`,
    };
  }
  if (semester !== "1" && semester !== "2") {
    return { ok: false, error: "O semestre deve ser 1 ou 2." };
  }

  const period = `${year}.${semester}`;
  if (existingPeriods.some((existing) => existing.trim() === period)) {
    return { ok: false, error: `A oferta ${period} já existe.` };
  }
  return { ok: true, period };
}

/**
 * The period the dialog opens on: the semester after the course's most recent
 * offer, or the current semester for a course with none.
 */
export function suggestNextPeriod(
  existingPeriods: string[],
  today: Date = new Date(),
): { year: string; semester: string } {
  const latest = [...existingPeriods]
    .sort(comparePeriodsLatestFirst)
    .map(parsePeriod)
    .find(
      (parsed) => parsed && (parsed.semester === 1 || parsed.semester === 2),
    );

  if (!latest) {
    return {
      year: String(today.getFullYear()),
      semester: today.getMonth() < 6 ? "1" : "2",
    };
  }
  return latest.semester === 1
    ? { year: String(latest.year), semester: "2" }
    : { year: String(latest.year + 1), semester: "1" };
}
