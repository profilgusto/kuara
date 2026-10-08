/**
 * offer-period.test.ts — which offer the offers page opens on.
 *
 * Periods are typed by hand in Payload, so the odd shapes are covered too.
 */
import { describe, it, expect } from "vitest";
import {
  buildPeriod,
  comparePeriodsLatestFirst,
  offerLabel,
  parsePeriod,
  pickActiveOffer,
  sanitizeSemesterInput,
  sanitizeYearInput,
  sortOffersLatestFirst,
  suggestNextPeriod,
} from "./offer-period";

const offer = (id: number, period: string, status = "active") => ({
  id,
  period,
  status,
});
const periods = (list: { period: string }[]) => list.map((o) => o.period);

describe("parsePeriod", () => {
  it("reads YEAR.SEMESTER", () => {
    expect(parsePeriod("2026.2")).toEqual({ year: 2026, semester: 2 });
    expect(parsePeriod(" 2026.1 ")).toEqual({ year: 2026, semester: 1 });
  });

  it.each(["", "2026", "2026-2", "26.2", "2026.2a", "verão 2026", "2026.2.1"])(
    "rejects %j",
    (text) => {
      expect(parsePeriod(text)).toBeNull();
    },
  );
});

describe("sortOffersLatestFirst", () => {
  it("orders by year, then semester, most recent first", () => {
    const sorted = sortOffersLatestFirst([
      offer(1, "2025.2"),
      offer(2, "2026.2"),
      offer(3, "2024.1"),
      offer(4, "2026.1"),
    ]);
    expect(periods(sorted)).toEqual(["2026.2", "2026.1", "2025.2", "2024.1"]);
  });

  it("compares semesters as numbers, not text", () => {
    expect(comparePeriodsLatestFirst("2026.10", "2026.9")).toBeLessThan(0);
  });

  it("puts periods that do not fit the pattern last", () => {
    const sorted = sortOffersLatestFirst([
      offer(1, "especial"),
      offer(2, "2019.1"),
      offer(3, "verão"),
      offer(4, "2026.2"),
    ]);
    expect(periods(sorted)).toEqual(["2026.2", "2019.1", "verão", "especial"]);
  });

  it("does not reorder the list it was given", () => {
    const original = [offer(1, "2024.1"), offer(2, "2026.2")];
    sortOffersLatestFirst(original);
    expect(periods(original)).toEqual(["2024.1", "2026.2"]);
  });
});

describe("pickActiveOffer", () => {
  const offers = [offer(1, "2025.2"), offer(2, "2026.2"), offer(3, "2026.1")];

  it("opens on the most recent offer by default", () => {
    expect(pickActiveOffer(offers)?.period).toBe("2026.2");
    expect(pickActiveOffer(offers, null)?.period).toBe("2026.2");
    expect(pickActiveOffer(offers, "")?.period).toBe("2026.2");
  });

  it("opens on the requested offer when it exists", () => {
    expect(pickActiveOffer(offers, "2025.2")?.id).toBe(1);
    expect(pickActiveOffer(offers, " 2026.1 ")?.id).toBe(3);
  });

  it("falls back to the most recent when the requested one does not exist", () => {
    expect(pickActiveOffer(offers, "1999.1")?.period).toBe("2026.2");
  });

  it("opens on an archived offer too, if it is the most recent", () => {
    const list = [offer(1, "2025.1"), offer(2, "2026.1", "archived")];
    expect(pickActiveOffer(list)?.id).toBe(2);
  });

  it("returns null for a course with no offers", () => {
    expect(pickActiveOffer([])).toBeNull();
    expect(pickActiveOffer([], "2026.2")).toBeNull();
  });
});

describe("offerLabel", () => {
  it("shows the period, flagging an archived offer", () => {
    expect(offerLabel(offer(1, "2026.2"))).toBe("2026.2");
    expect(offerLabel(offer(1, "2025.1", "archived"))).toBe(
      "2025.1 (arquivada)",
    );
  });
});

describe("sanitizeYearInput", () => {
  it("keeps digits only, four at most", () => {
    expect(sanitizeYearInput("2027")).toBe("2027");
    expect(sanitizeYearInput("20a2.7x")).toBe("2027");
    expect(sanitizeYearInput("202712")).toBe("2027");
    expect(sanitizeYearInput("ano")).toBe("");
  });
});

describe("sanitizeSemesterInput", () => {
  it("keeps a single 1 or 2", () => {
    expect(sanitizeSemesterInput("1")).toBe("1");
    expect(sanitizeSemesterInput("2")).toBe("2");
  });

  it.each(["3", "0", "a", ".", " "])("drops %j", (text) => {
    expect(sanitizeSemesterInput(text)).toBe("");
  });

  it("lets a new digit replace the one already there", () => {
    expect(sanitizeSemesterInput("12")).toBe("2");
    expect(sanitizeSemesterInput("21")).toBe("1");
    expect(sanitizeSemesterInput("13")).toBe("1");
  });
});

describe("buildPeriod", () => {
  it("joins a valid year and semester", () => {
    expect(buildPeriod("2027", "1")).toEqual({ ok: true, period: "2027.1" });
    expect(buildPeriod(" 2027 ", " 2 ")).toEqual({
      ok: true,
      period: "2027.2",
    });
  });

  it.each(["", "27", "202", "20277", "20a7", "2027.1"])(
    "refuses the year %j",
    (year) => {
      expect(buildPeriod(year, "1")).toEqual({
        ok: false,
        error: "Informe o ano com quatro dígitos.",
      });
    },
  );

  it("refuses a year outside the accepted range", () => {
    expect(buildPeriod("1999", "1").ok).toBe(false);
    expect(buildPeriod("2101", "1").ok).toBe(false);
    expect(buildPeriod("2000", "1").ok).toBe(true);
    expect(buildPeriod("2100", "2").ok).toBe(true);
  });

  it.each(["", "0", "3", "12", "a", "1.0"])(
    "refuses the semester %j",
    (semester) => {
      expect(buildPeriod("2027", semester)).toEqual({
        ok: false,
        error: "O semestre deve ser 1 ou 2.",
      });
    },
  );

  it("refuses a period the course already has", () => {
    expect(buildPeriod("2026", "2", ["2026.1", " 2026.2 "])).toEqual({
      ok: false,
      error: "A oferta 2026.2 já existe.",
    });
    expect(buildPeriod("2027", "1", ["2026.1", "2026.2"]).ok).toBe(true);
  });
});

describe("suggestNextPeriod", () => {
  it("suggests the semester after the most recent offer", () => {
    expect(suggestNextPeriod(["2025.2", "2026.1"])).toEqual({
      year: "2026",
      semester: "2",
    });
    expect(suggestNextPeriod(["2026.2", "2026.1"])).toEqual({
      year: "2027",
      semester: "1",
    });
  });

  it("ignores periods outside the pattern", () => {
    expect(suggestNextPeriod(["especial", "2026.3", "2025.2"])).toEqual({
      year: "2026",
      semester: "1",
    });
  });

  it("suggests the current semester for a course with no offers", () => {
    expect(suggestNextPeriod([], new Date(2026, 2, 10))).toEqual({
      year: "2026",
      semester: "1",
    });
    expect(suggestNextPeriod([], new Date(2026, 9, 8))).toEqual({
      year: "2026",
      semester: "2",
    });
  });
});
