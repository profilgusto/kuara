/**
 * group-draw.test.ts — drawing students into work groups.
 *
 * The randomness is injected, so each draw below is replayable; what is
 * checked is the shape of the result (who can end up with whom, how many per
 * group), not a particular permutation.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_GROUP_SIZE,
  describeGroupSizes,
  drawPools,
  groupSizes,
  nextGroupNumber,
  parseGroupSize,
  planGroupDraw,
  previewGroupSizes,
  shuffle,
  validateDrawRequest,
  validateGroupName,
} from "./group-draw";

/** A deterministic stand-in for Math.random. */
function seeded(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const students = (n: number, classGroup?: "A" | "B" | null, from = 1) =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, classGroup }));

describe("groupSizes", () => {
  it("splits evenly when the class divides by the size", () => {
    expect(groupSizes(12, 4)).toEqual([4, 4, 4]);
  });

  it("makes a group larger rather than leaving a student alone", () => {
    expect(groupSizes(33, 4)).toEqual([5, 4, 4, 4, 4, 4, 4, 4]);
    expect(groupSizes(13, 4)).toEqual([5, 4, 4]);
  });

  it("makes groups smaller when that is closer to the size asked for", () => {
    expect(groupSizes(34, 4)).toEqual([4, 4, 4, 4, 4, 4, 4, 3, 3]);
    expect(groupSizes(7, 4)).toEqual([4, 3]);
  });

  it("never differs by more than one student between groups", () => {
    for (let count = 1; count <= 60; count++) {
      for (let size = 1; size <= 8; size++) {
        const sizes = groupSizes(count, size);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(count);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("puts everyone in one group when the size exceeds the class", () => {
    expect(groupSizes(3, 10)).toEqual([3]);
  });

  it("makes no groups out of nobody, or out of a size of zero", () => {
    expect(groupSizes(0, 4)).toEqual([]);
    expect(groupSizes(10, 0)).toEqual([]);
  });
});

describe("describeGroupSizes", () => {
  it("summarises the sizes for the preview", () => {
    expect(describeGroupSizes([5, 4, 4, 4])).toBe("4 grupos: 1 de 5 e 3 de 4");
    expect(describeGroupSizes([4, 4, 4])).toBe("3 grupos: 3 de 4");
    expect(describeGroupSizes([3])).toBe("1 grupo de 3");
    expect(describeGroupSizes([])).toBe("nenhum grupo");
  });
});

describe("shuffle", () => {
  it("keeps every item exactly once and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    const result = shuffle(input, seeded());
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("follows the random source", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(input, seeded(1))).toEqual(shuffle(input, seeded(1)));
    expect(shuffle(input, seeded(1))).not.toEqual(shuffle(input, seeded(2)));
    expect(shuffle(input, seeded(1))).not.toEqual(input);
  });
});

describe("nextGroupNumber", () => {
  it("starts at 1 and continues past the highest generic name", () => {
    expect(nextGroupNumber([])).toBe(1);
    expect(nextGroupNumber(["Grupo 1", "Grupo 2"])).toBe(3);
    expect(nextGroupNumber(["grupo 7", " Grupo 3 "])).toBe(8);
  });

  it("ignores names that are not generic", () => {
    expect(nextGroupNumber(["RBA Engenharia", "Grupo A", "Grupo 2 B"])).toBe(1);
  });
});

describe("drawPools", () => {
  const mixed = [
    ...students(3, "A"),
    ...students(2, "B", 10),
    ...students(1, null, 20),
  ];

  it("is a single pool when drawing among everybody", () => {
    expect(drawPools(mixed, "all")).toEqual([mixed]);
  });

  it("is one pool per subturma, A then B then the rest", () => {
    expect(
      drawPools(mixed, "classGroup").map((pool) => pool.map((s) => s.id)),
    ).toEqual([[1, 2, 3], [10, 11], [20]]);
  });

  it("has no empty pools", () => {
    expect(drawPools(students(3, "A"), "classGroup")).toHaveLength(1);
    expect(drawPools([], "all")).toEqual([]);
  });
});

describe("planGroupDraw", () => {
  it("puts every student in exactly one group", () => {
    const plan = planGroupDraw({
      students: students(33),
      size: 4,
      scope: "all",
      random: seeded(),
    });
    const ids = plan.flatMap((g) => g.memberIds);
    expect(ids).toHaveLength(33);
    expect(new Set(ids).size).toBe(33);
    expect(plan.map((g) => g.memberIds.length)).toEqual([
      5, 4, 4, 4, 4, 4, 4, 4,
    ]);
  });

  it("names the groups generically, in sequence", () => {
    const plan = planGroupDraw({
      students: students(6),
      size: 2,
      scope: "all",
      random: seeded(),
    });
    expect(plan.map((g) => g.name)).toEqual(["Grupo 1", "Grupo 2", "Grupo 3"]);
  });

  it("continues the numbering after the groups that already exist", () => {
    const plan = planGroupDraw({
      students: students(4),
      size: 2,
      scope: "all",
      existingNames: ["Grupo 1", "Grupo 2", "RBA Engenharia"],
      random: seeded(),
    });
    expect(plan.map((g) => g.name)).toEqual(["Grupo 3", "Grupo 4"]);
  });

  it("actually mixes the students", () => {
    const plan = planGroupDraw({
      students: students(20),
      size: 4,
      scope: "all",
      random: seeded(),
    });
    expect(plan.flatMap((g) => g.memberIds)).not.toEqual(
      students(20).map((s) => s.id),
    );
  });

  it("never mixes subturmas when drawing inside each one", () => {
    const classA = students(9, "A");
    const classB = students(7, "B", 100);
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = planGroupDraw({
        students: [...classA, ...classB],
        size: 3,
        scope: "classGroup",
        random: seeded(seed),
      });
      for (const group of plan) {
        const sides = new Set(group.memberIds.map((id) => Number(id) >= 100));
        expect(sides.size).toBe(1);
      }
      expect(plan.map((g) => g.memberIds.length)).toEqual([3, 3, 3, 4, 3]);
      expect(plan.map((g) => g.name)).toEqual([
        "Grupo 1",
        "Grupo 2",
        "Grupo 3",
        "Grupo 4",
        "Grupo 5",
      ]);
    }
  });

  it("does mix subturmas when drawing among everybody", () => {
    const plan = planGroupDraw({
      students: [...students(10, "A"), ...students(10, "B", 100)],
      size: 5,
      scope: "all",
      random: seeded(),
    });
    const mixed = plan.some(
      (g) => new Set(g.memberIds.map((id) => Number(id) >= 100)).size === 2,
    );
    expect(mixed).toBe(true);
  });

  it("makes nothing out of nobody", () => {
    expect(planGroupDraw({ students: [], size: 4, scope: "all" })).toEqual([]);
  });
});

describe("previewGroupSizes", () => {
  it("matches what the draw will make", () => {
    const list = [...students(9, "A"), ...students(7, "B", 100)];
    expect(previewGroupSizes(list, 3, "classGroup")).toEqual([3, 3, 3, 4, 3]);
    expect(previewGroupSizes(list, 3, "all")).toEqual([4, 3, 3, 3, 3]);
  });
});

describe("parseGroupSize", () => {
  it("accepts whole numbers in range, typed or numeric", () => {
    expect(parseGroupSize("4")).toBe(4);
    expect(parseGroupSize(" 12 ")).toBe(12);
    expect(parseGroupSize(3)).toBe(3);
    expect(parseGroupSize(String(MAX_GROUP_SIZE))).toBe(MAX_GROUP_SIZE);
  });

  it.each(["", "0", "-2", "2.5", "abc", "51", 0, 2.5, null, undefined])(
    "rejects %j",
    (value) => {
      expect(parseGroupSize(value)).toBeNull();
    },
  );
});

describe("validateDrawRequest", () => {
  const valid = { offer: 7, size: 4, scope: "all" };

  it("accepts a complete request", () => {
    expect(validateDrawRequest(valid)).toEqual({ ok: true, ...valid });
    expect(validateDrawRequest({ ...valid, scope: "classGroup" }).ok).toBe(
      true,
    );
  });

  it.each([
    [null],
    ["x"],
    [{ ...valid, offer: undefined }],
    [{ ...valid, offer: 1.5 }],
    [{ ...valid, size: 0 }],
    [{ ...valid, size: "muitos" }],
    [{ ...valid, scope: "turma" }],
    [{ ...valid, scope: undefined }],
  ])("refuses %j", (body) => {
    expect(validateDrawRequest(body).ok).toBe(false);
  });
});

describe("validateGroupName", () => {
  it("accepts a name, tidying whitespace", () => {
    expect(validateGroupName("  RBA   Engenharia ")).toEqual({
      ok: true,
      name: "RBA Engenharia",
    });
  });

  it("refuses an empty or over-long name", () => {
    expect(validateGroupName("   ").ok).toBe(false);
    expect(validateGroupName("a".repeat(81)).ok).toBe(false);
  });

  it("refuses a name the offer already has, whatever its case or spacing", () => {
    expect(
      validateGroupName("rba  engenharia", ["Grupo 1", "RBA Engenharia"]),
    ).toEqual({
      ok: false,
      error: "Já existe um grupo chamado “rba engenharia”.",
    });
    expect(validateGroupName("Grupo 2", ["Grupo 1"]).ok).toBe(true);
  });
});
