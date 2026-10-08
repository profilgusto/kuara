/**
 * enrollment.test.ts — what may be enrolled in an offer, and how the table
 * orders it. `validateEnrollmentImport` guards an endpoint, so the hostile
 * shapes are spelled out.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_IMPORT_SIZE,
  classGroupLabel,
  filterAndSortEnrollments,
  groupEnrollments,
  groupOfDropId,
  sectionDropId,
  normalizeRegistration,
  parseClassGroup,
  validateEnrollmentImport,
  validateStudent,
} from "./enrollment";

describe("normalizeRegistration", () => {
  it("accepts digits, as text or as a number", () => {
    expect(normalizeRegistration("214450010")).toBe("214450010");
    expect(normalizeRegistration(" 2023011671 ")).toBe("2023011671");
    expect(normalizeRegistration(214450010)).toBe("214450010");
    expect(normalizeRegistration(214450010.0)).toBe("214450010");
  });

  it("keeps leading zeros", () => {
    expect(normalizeRegistration("004450010")).toBe("004450010");
  });

  it.each(["", "abc", "21445001a", "21.445", "123", "1".repeat(21), null, {}])(
    "rejects %j",
    (value) => {
      expect(normalizeRegistration(value)).toBeNull();
    },
  );

  it("rejects a number that is not finite", () => {
    expect(normalizeRegistration(NaN)).toBeNull();
    expect(normalizeRegistration(Infinity)).toBeNull();
  });
});

describe("parseClassGroup", () => {
  it("knows A and B, and nothing else", () => {
    expect(parseClassGroup("A")).toBe("A");
    expect(parseClassGroup("B")).toBe("B");
    for (const value of ["C", "a", "", null, undefined, 1]) {
      expect(parseClassGroup(value)).toBeNull();
    }
  });
});

describe("validateStudent", () => {
  it("accepts a matrícula and a name, tidying whitespace", () => {
    expect(validateStudent(" 214450010 ", "  Ana   Souza ")).toEqual({
      ok: true,
      student: { registration: "214450010", name: "Ana Souza" },
    });
  });

  it("refuses a bad matrícula or an empty name", () => {
    expect(validateStudent("21a", "Ana").ok).toBe(false);
    expect(validateStudent("214450010", "   ")).toEqual({
      ok: false,
      error: "Informe o nome do discente.",
    });
    expect(validateStudent("214450010", 42).ok).toBe(false);
    expect(validateStudent("214450010", "a".repeat(201)).ok).toBe(false);
  });
});

describe("validateEnrollmentImport", () => {
  const students = [
    { registration: "214450010", name: "Ana Souza" },
    { registration: "204300051", name: "Bruno Lima" },
  ];
  const valid = { offer: 7, classGroup: "A", students };

  it("accepts a complete import", () => {
    expect(validateEnrollmentImport(valid)).toEqual({
      ok: true,
      offer: 7,
      classGroup: "A",
      students,
    });
  });

  it("treats a missing or null class group as the whole class", () => {
    const whole = validateEnrollmentImport({ offer: 7, students });
    expect(whole.ok && whole.classGroup).toBeNull();
    const explicit = validateEnrollmentImport({ ...valid, classGroup: null });
    expect(explicit.ok && explicit.classGroup).toBeNull();
  });

  it("refuses a class group that does not exist", () => {
    expect(validateEnrollmentImport({ ...valid, classGroup: "C" })).toEqual({
      ok: false,
      error: "Turma inválida.",
    });
  });

  it("drops fields a student entry should not carry", () => {
    const result = validateEnrollmentImport({
      ...valid,
      students: [{ ...students[0], offer: 99, id: 1, classGroup: "B" }],
    });
    expect(result.ok && result.students).toEqual([students[0]]);
  });

  it("keeps the last entry of a matrícula listed twice", () => {
    const result = validateEnrollmentImport({
      ...valid,
      students: [...students, { registration: "214450010", name: "Ana S." }],
    });
    expect(result.ok && result.students).toEqual([
      { registration: "214450010", name: "Ana S." },
      students[1],
    ]);
  });

  it("names the line of the first bad student", () => {
    expect(
      validateEnrollmentImport({
        ...valid,
        students: [students[0], { registration: "x", name: "Sem Matrícula" }],
      }),
    ).toEqual({
      ok: false,
      error:
        "Linha 2: Informe a matrícula usando apenas números (4 a 20 dígitos).",
    });
    expect(validateEnrollmentImport({ ...valid, students: [null] }).ok).toBe(
      false,
    );
  });

  it.each([null, "texto", 42, [valid]])("refuses the body %j", (body) => {
    expect(validateEnrollmentImport(body).ok).toBe(false);
  });

  it.each([undefined, null, "", "  ", 1.5, {}])(
    "refuses the offer %j",
    (offer) => {
      expect(validateEnrollmentImport({ ...valid, offer })).toEqual({
        ok: false,
        error: "Oferta não informada.",
      });
    },
  );

  it("refuses an empty or oversized list", () => {
    expect(validateEnrollmentImport({ ...valid, students: [] }).ok).toBe(false);
    expect(validateEnrollmentImport({ ...valid, students: "x" }).ok).toBe(
      false,
    );
    const many = Array.from({ length: MAX_IMPORT_SIZE + 1 }, (_, i) => ({
      registration: String(100000 + i),
      name: "Aluno",
    }));
    expect(validateEnrollmentImport({ ...valid, students: many }).ok).toBe(
      false,
    );
    expect(
      validateEnrollmentImport({ ...valid, students: many.slice(1) }).ok,
    ).toBe(true);
  });
});

describe("filterAndSortEnrollments", () => {
  const rows = [
    { id: 1, registration: "214450010", name: "Bruno Lima" },
    { id: 2, registration: "204300051", name: "Ângela Dias" },
    { id: 3, registration: "2023011671", name: "carlos Reis" },
  ];
  const names = (list: { name: string }[]) => list.map((r) => r.name);

  it("sorts by name ignoring accents and case", () => {
    expect(names(filterAndSortEnrollments(rows, "", "name", "asc"))).toEqual([
      "Ângela Dias",
      "Bruno Lima",
      "carlos Reis",
    ]);
    expect(names(filterAndSortEnrollments(rows, "", "name", "desc"))).toEqual([
      "carlos Reis",
      "Bruno Lima",
      "Ângela Dias",
    ]);
  });

  it("sorts by matrícula as a number, not as text", () => {
    expect(
      filterAndSortEnrollments(rows, "", "registration", "asc").map(
        (r) => r.registration,
      ),
    ).toEqual(["204300051", "214450010", "2023011671"]);
  });

  it("sorts by turma: A, then B, then no turma — names A→Z inside each", () => {
    const mixed = [
      { id: 1, registration: "1001", name: "Bruno", classGroup: "B" as const },
      { id: 2, registration: "1002", name: "Davi" },
      { id: 3, registration: "1003", name: "Carla", classGroup: "A" as const },
      { id: 4, registration: "1004", name: "Ana", classGroup: "B" as const },
      { id: 5, registration: "1005", name: "Érica", classGroup: "A" as const },
    ];
    expect(
      names(filterAndSortEnrollments(mixed, "", "classGroup", "asc")),
    ).toEqual(["Carla", "Érica", "Ana", "Bruno", "Davi"]);
    // Flipped: B before A, but names still A→Z and no-turma still last.
    expect(
      names(filterAndSortEnrollments(mixed, "", "classGroup", "desc")),
    ).toEqual(["Ana", "Bruno", "Carla", "Érica", "Davi"]);
  });

  it("searches by name without accents, and by matrícula", () => {
    expect(
      names(filterAndSortEnrollments(rows, "angela", "name", "asc")),
    ).toEqual(["Ângela Dias"]);
    expect(
      names(filterAndSortEnrollments(rows, " LIMA ", "name", "asc")),
    ).toEqual(["Bruno Lima"]);
    expect(
      names(filterAndSortEnrollments(rows, "2023", "name", "asc")),
    ).toEqual(["carlos Reis"]);
    expect(filterAndSortEnrollments(rows, "zzz", "name", "asc")).toEqual([]);
  });

  it("does not reorder the list it was given", () => {
    filterAndSortEnrollments(rows, "", "name", "asc");
    expect(rows[0].name).toBe("Bruno Lima");
  });
});

describe("classGroupLabel", () => {
  it("names the three choices", () => {
    expect(classGroupLabel(null)).toBe("Turma completa");
    expect(classGroupLabel(undefined)).toBe("Turma completa");
    expect(classGroupLabel("A")).toBe("Turma A");
    expect(classGroupLabel("B")).toBe("Turma B");
  });
});

describe("groupEnrollments", () => {
  const groups = [
    { id: 3, name: "Grupo 10" },
    { id: 1, name: "grupo 2" },
    { id: 2, name: "Equipe Ômega" },
  ];
  const row = (id: number, name: string, groupId?: number | string | null) => ({
    id,
    registration: String(1000 + id),
    name,
    groupId,
  });
  const shape = (sections: ReturnType<typeof groupEnrollments>) =>
    sections.map((s) => [s.group?.name ?? null, s.rows.map((r) => r.name)]);

  it("lists groups in alphabetical order, numbers counted as numbers", () => {
    expect(shape(groupEnrollments([], groups))).toEqual([
      ["Equipe Ômega", []],
      ["grupo 2", []],
      ["Grupo 10", []],
    ]);
  });

  it("puts each student under their group, keeping the order given", () => {
    const rows = [
      row(1, "Ana", 1),
      row(2, "Bruno", 3),
      row(3, "Carla", 1),
      row(4, "Davi", 2),
    ];
    expect(shape(groupEnrollments(rows, groups))).toEqual([
      ["Equipe Ômega", ["Davi"]],
      ["grupo 2", ["Ana", "Carla"]],
      ["Grupo 10", ["Bruno"]],
    ]);
  });

  it("gathers students with no group in a last section", () => {
    const rows = [row(1, "Ana", 1), row(2, "Bruno", null), row(3, "Carla")];
    const sections = groupEnrollments(rows, groups);
    expect(shape(sections).at(-1)).toEqual([null, ["Bruno", "Carla"]]);
    expect(sections).toHaveLength(4);
  });

  it("has no ungrouped section when everyone is in a group", () => {
    const sections = groupEnrollments([row(1, "Ana", 1)], groups);
    expect(sections.every((s) => s.group !== null)).toBe(true);
  });

  it("treats a group that is not in the list as no group", () => {
    expect(shape(groupEnrollments([row(1, "Ana", 99)], groups)).at(-1)).toEqual(
      [null, ["Ana"]],
    );
  });

  it("matches ids whether they come as numbers or as text", () => {
    expect(shape(groupEnrollments([row(1, "Ana", "2")], groups))[0]).toEqual([
      "Equipe Ômega",
      ["Ana"],
    ]);
  });

  it("with no groups at all, everybody is ungrouped", () => {
    expect(
      shape(groupEnrollments([row(1, "Ana"), row(2, "Bruno")], [])),
    ).toEqual([[null, ["Ana", "Bruno"]]]);
    expect(groupEnrollments([], [])).toEqual([]);
  });
});

describe("drop zones", () => {
  it("names a zone per group, and one for no group", () => {
    expect(sectionDropId({ id: 12, name: "Grupo 1" })).toBe("group:12");
    expect(sectionDropId(null)).toBe("ungrouped");
  });

  it("reads back which group a zone stands for", () => {
    expect(groupOfDropId("group:12")).toBe("12");
    expect(groupOfDropId(sectionDropId({ id: "a1", name: "x" }))).toBe("a1");
    expect(groupOfDropId("ungrouped")).toBeNull();
  });

  it.each([undefined, null, "", "row:3", "group:", 12])(
    "does not take %j for a zone",
    (value) => {
      expect(groupOfDropId(value)).toBeUndefined();
    },
  );
});
