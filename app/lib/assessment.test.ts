/**
 * assessment.test.ts — points typed into the assessments table, and their
 * sums. The sums decide what is flagged in red, so the floating-point traps
 * are covered explicitly.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_ASSESSMENT_DRAFT,
  categoryLabel,
  dueDateToStored,
  formatDueDate,
  parseDueDate,
  formatPoints,
  parseAssessmentCategory,
  modeLabel,
  parseAssessmentMode,
  parseScoringUnit,
  parseTasks,
  parseWeight,
  sanitizeCodeInput,
  scoringUnitFromActivityType,
  scoringUnitLabel,
  scoringUnitToActivityType,
  sumAssessments,
  validateAssessment,
  validateTaskList,
} from "./assessment";

describe("parseWeight", () => {
  it("reads whole and one-decimal points, with dot or comma", () => {
    expect(parseWeight("2")).toBe(2);
    expect(parseWeight("2.5")).toBe(2.5);
    expect(parseWeight("2,5")).toBe(2.5);
    expect(parseWeight(" 10.0 ")).toBe(10);
    expect(parseWeight("0.1")).toBe(0.1);
    expect(parseWeight("10")).toBe(10);
  });

  it.each(["", "abc", "2.55", "2.", ".5", "-1", "1e1", "2..5", "2 5", "100"])(
    "rejects %j",
    (text) => {
      expect(parseWeight(text)).toBeNull();
    },
  );

  it("rejects zero and anything above the semester's 10.0", () => {
    expect(parseWeight("0")).toBeNull();
    expect(parseWeight("0.0")).toBeNull();
    expect(parseWeight("10.1")).toBeNull();
    expect(parseWeight("11")).toBeNull();
  });
});

describe("formatPoints", () => {
  it("always shows one decimal, with a dot", () => {
    expect(formatPoints(0)).toBe("0.0");
    expect(formatPoints(5.9)).toBe("5.9");
    expect(formatPoints(10)).toBe("10.0");
  });

  it("hides floating-point noise", () => {
    expect(formatPoints(0.1 + 0.2)).toBe("0.3");
    expect(formatPoints(2.3000000000000003)).toBe("2.3");
  });
});

describe("sanitizeCodeInput", () => {
  it("upper-cases, drops spaces and caps the length", () => {
    expect(sanitizeCodeInput("p1")).toBe("P1");
    expect(sanitizeCodeInput(" t f ")).toBe("TF");
    expect(sanitizeCodeInput("avaliação")).toBe("AVALIAÇÃ");
  });
});

describe("validateAssessment", () => {
  const draft = {
    code: "p1",
    name: " Prova  Prática ",
    weight: "3,5",
    category: "regular" as const,
    scoredBy: "student" as const,
    mode: "graded" as const,
    dueDate: "",
    comment: "",
  };

  it("accepts a complete row, normalising what was typed", () => {
    expect(validateAssessment(draft)).toEqual({
      ok: true,
      assessment: {
        code: "P1",
        name: "Prova Prática",
        weight: 3.5,
        category: "regular",
        scoredBy: "student",
        mode: "graded",
        dueDate: "",
        comment: "",
      },
    });
  });

  it("keeps the extra category", () => {
    const result = validateAssessment({ ...draft, category: "extra" });
    expect(result.ok && result.assessment.category).toBe("extra");
  });

  it("refuses a code already used in the offer, whatever its case", () => {
    expect(validateAssessment(draft, ["TF", "p1"])).toEqual({
      ok: false,
      error: "Já existe uma avaliação com o código P1.",
    });
    expect(validateAssessment(draft, ["TF", "P2"]).ok).toBe(true);
  });

  it("refuses missing fields, in the order they appear in the row", () => {
    expect(validateAssessment(EMPTY_ASSESSMENT_DRAFT)).toEqual({
      ok: false,
      error: "Informe o código da avaliação.",
    });
    expect(validateAssessment({ ...draft, name: "  " })).toEqual({
      ok: false,
      error: "Informe o nome da avaliação.",
    });
    expect(validateAssessment({ ...draft, weight: "" }).ok).toBe(false);
    expect(validateAssessment({ ...draft, weight: "12" }).ok).toBe(false);
    expect(validateAssessment({ ...draft, name: "a".repeat(121) }).ok).toBe(
      false,
    );
  });
});

describe("due date and comment", () => {
  const draft = {
    code: "p1",
    name: "Prova",
    weight: "3",
    category: "regular" as const,
    scoredBy: "student" as const,
    mode: "graded" as const,
    dueDate: "",
    comment: "",
  };

  it("are optional", () => {
    const result = validateAssessment(draft);
    expect(
      result.ok && [result.assessment.dueDate, result.assessment.comment],
    ).toEqual(["", ""]);
  });

  it("keep a real day and a trimmed comment", () => {
    const result = validateAssessment({
      ...draft,
      dueDate: "2026-11-05",
      comment: "  Em duplas.  ",
    });
    expect(result.ok && result.assessment).toMatchObject({
      dueDate: "2026-11-05",
      comment: "Em duplas.",
    });
  });

  it.each(["2026-02-30", "05/11/2026", "2026-13-01", "abc"])(
    "refuse the day %j",
    (dueDate) => {
      expect(validateAssessment({ ...draft, dueDate })).toEqual({
        ok: false,
        error: "Informe uma data de entrega válida.",
      });
    },
  );

  it("refuse a comment over the limit", () => {
    expect(validateAssessment({ ...draft, comment: "a".repeat(501) }).ok).toBe(
      false,
    );
    expect(validateAssessment({ ...draft, comment: "a".repeat(500) }).ok).toBe(
      true,
    );
  });

  it("read the stored timestamp back as the same day, and write it at noon UTC", () => {
    expect(parseDueDate("2026-11-05T12:00:00.000Z")).toBe("2026-11-05");
    expect(parseDueDate("2026-11-05T00:00:00.000Z")).toBe("2026-11-05");
    expect(parseDueDate(null)).toBe("");
    expect(parseDueDate("lixo")).toBe("");
    expect(dueDateToStored("2026-11-05")).toBe("2026-11-05T12:00:00.000Z");
    expect(dueDateToStored("")).toBeNull();
  });

  it("show as dd/mm/aaaa", () => {
    expect(formatDueDate("2026-11-05")).toBe("05/11/2026");
    expect(formatDueDate("")).toBe("");
    expect(formatDueDate(undefined)).toBe("");
  });
});

describe("sumAssessments", () => {
  const row = (weight: number, category: "regular" | "extra" = "regular") => ({
    weight,
    category,
  });

  it("adds regular and extra points separately, and together", () => {
    expect(
      sumAssessments([
        row(4),
        row(3.5),
        row(2.5),
        row(1, "extra"),
        row(0.5, "extra"),
      ]),
    ).toEqual({
      regular: 10,
      extra: 1.5,
      total: 11.5,
      regularIsComplete: true,
    });
  });

  it("is zero for an offer with no assessments", () => {
    expect(sumAssessments([])).toEqual({
      regular: 0,
      extra: 0,
      total: 0,
      regularIsComplete: false,
    });
  });

  it("flags a regular sum short of or beyond 10.0", () => {
    expect(sumAssessments([row(4), row(5.9)]).regularIsComplete).toBe(false);
    expect(sumAssessments([row(6), row(4.1)]).regularIsComplete).toBe(false);
  });

  it("does not let extras complete the regular sum", () => {
    const totals = sumAssessments([row(8), row(2, "extra")]);
    expect(totals.total).toBe(10);
    expect(totals.regularIsComplete).toBe(false);
  });

  it("adds in tenths, so the result carries no floating-point residue", () => {
    // As plain floats, 0.1 + 0.2 is 0.30000000000000004.
    expect(sumAssessments([row(0.1), row(0.2)]).regular).toBe(0.3);
    expect(sumAssessments([row(0.1, "extra"), row(0.2, "extra")]).extra).toBe(
      0.3,
    );
    expect(sumAssessments([row(0.1), row(0.2, "extra")]).total).toBe(0.3);
  });

  it("reaches exactly 10.0 from many small weights", () => {
    const weights = [0.1, 0.2, 0.3, 0.7, 1.1, 2.2, 3.3, 2.1];
    const totals = sumAssessments(weights.map((w) => row(w)));
    expect(totals.regular).toBe(10);
    expect(totals.regularIsComplete).toBe(true);
  });
});

describe("categories", () => {
  it("treats anything unknown as regular", () => {
    expect(parseAssessmentCategory("extra")).toBe("extra");
    for (const value of ["regular", "", null, undefined, "bonus"]) {
      expect(parseAssessmentCategory(value)).toBe("regular");
    }
  });

  it("has a label for each", () => {
    expect(categoryLabel("regular")).toBe("Regular");
    expect(categoryLabel("extra")).toBe("Extra");
  });
});

describe("scoring unit", () => {
  it("is per student unless it says group", () => {
    expect(parseScoringUnit("group")).toBe("group");
    for (const value of ["student", "", null, undefined, "turma"]) {
      expect(parseScoringUnit(value)).toBe("student");
    }
  });

  it("has a label for each", () => {
    expect(scoringUnitLabel("student")).toBe("Discente");
    expect(scoringUnitLabel("group")).toBe("Grupo");
  });

  it("round-trips through the name Payload stores it under", () => {
    expect(scoringUnitToActivityType("student")).toBe("individual");
    expect(scoringUnitToActivityType("group")).toBe("group");
    expect(scoringUnitFromActivityType("individual")).toBe("student");
    expect(scoringUnitFromActivityType("group")).toBe("group");
    expect(scoringUnitFromActivityType(undefined)).toBe("student");
  });

  it("is kept by validation", () => {
    const result = validateAssessment({
      code: "SEM",
      name: "Seminário",
      weight: "2",
      category: "regular",
      scoredBy: "group",
      mode: "graded",
      dueDate: "",
      comment: "",
    });
    expect(result.ok && result.assessment.scoredBy).toBe("group");
  });
});

describe("assessment mode", () => {
  it("is one mark per student unless it says checklist", () => {
    expect(parseAssessmentMode("checklist")).toBe("checklist");
    for (const value of ["graded", "", null, undefined, "prova"]) {
      expect(parseAssessmentMode(value)).toBe("graded");
    }
  });

  it("has a label for each", () => {
    expect(modeLabel("graded")).toBe("Nota");
    expect(modeLabel("checklist")).toBe("Tarefas");
  });

  it("is kept by validation", () => {
    const result = validateAssessment({
      code: "EX",
      name: "Exercícios",
      weight: "2",
      category: "regular",
      scoredBy: "student",
      mode: "checklist",
      dueDate: "",
      comment: "",
    });
    expect(result.ok && result.assessment.mode).toBe("checklist");
  });
});

describe("parseTasks", () => {
  it("reads the tasks Payload returns, with their ids as text", () => {
    expect(
      parseTasks([
        { id: "a1", name: " Lista 1 " },
        { id: 7, name: "Lista 2" },
      ]),
    ).toEqual([
      { id: "a1", name: "Lista 1" },
      { id: "7", name: "Lista 2" },
    ]);
  });

  it("drops what is not a task", () => {
    expect(
      parseTasks([{ id: "a", name: "" }, { name: "Sem id" }, null, 3]),
    ).toEqual([]);
    expect(parseTasks(undefined)).toEqual([]);
    expect(parseTasks("tarefas")).toEqual([]);
  });
});

describe("task acronyms", () => {
  it("are read from Payload, tidied like assessment codes", () => {
    expect(
      parseTasks([
        { id: "a", code: " l 1 ", name: "Lista 1" },
        { id: "b", code: "", name: "Lista 2" },
        { id: "c", name: "Lista 3" },
      ]),
    ).toEqual([
      { id: "a", code: "L1", name: "Lista 1" },
      { id: "b", name: "Lista 2" },
      { id: "c", name: "Lista 3" },
    ]);
  });

  it("are kept by validation, upper-cased, and optional", () => {
    expect(
      validateTaskList([
        { id: "a", code: "l1", name: "Lista 1" },
        { name: "B" },
      ]),
    ).toEqual({
      ok: true,
      tasks: [{ id: "a", code: "L1", name: "Lista 1" }, { name: "B" }],
    });
  });

  it("must not repeat within an assessment, whatever the case", () => {
    expect(
      validateTaskList([
        { code: "L1", name: "Lista 1" },
        { code: "l1", name: "Lista 2" },
      ]),
    ).toEqual({
      ok: false,
      error: "Há duas tarefas com o acrônimo L1.",
    });
  });
});

describe("validateTaskList", () => {
  it("accepts named tasks, tidying whitespace and keeping ids", () => {
    expect(
      validateTaskList([
        { id: "a1", name: "  Lista   1 " },
        { name: "Lista 2" },
      ]),
    ).toEqual({
      ok: true,
      tasks: [{ id: "a1", name: "Lista 1" }, { name: "Lista 2" }],
    });
  });

  it("accepts an empty list", () => {
    expect(validateTaskList([])).toEqual({ ok: true, tasks: [] });
  });

  it("refuses a task with no name", () => {
    expect(validateTaskList([{ name: "Lista 1" }, { name: "  " }])).toEqual({
      ok: false,
      error: "Dê um nome a cada tarefa.",
    });
  });

  it("refuses two tasks with the same name, whatever the case", () => {
    expect(
      validateTaskList([{ name: "Lista 1" }, { name: "lista  1" }]),
    ).toEqual({
      ok: false,
      error: "Há duas tarefas chamadas “lista 1”.",
    });
  });

  it("refuses an over-long name or too many tasks", () => {
    expect(validateTaskList([{ name: "a".repeat(81) }]).ok).toBe(false);
    expect(
      validateTaskList(
        Array.from({ length: 61 }, (_, i) => ({ name: `T${i}` })),
      ).ok,
    ).toBe(false);
    expect(
      validateTaskList(
        Array.from({ length: 60 }, (_, i) => ({ name: `T${i}` })),
      ).ok,
    ).toBe(true);
  });
});
