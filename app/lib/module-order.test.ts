import { describe, it, expect } from "vitest";
import {
  joinsCourse,
  moveModule,
  numberModules,
  placeholderModuleSlug,
  planOrderUpdates,
  relationId,
} from "./module-order";

const T = "modulo-teorico";
const P = "modulo-pratico";
const A = "atividade-avaliativa";

const seq = [
  { id: "t1", type: T },
  { id: "p1", type: P },
  { id: "t2", type: T },
  { id: "a1", type: A },
  { id: "t3", type: T },
];
const ids = (list: { id: string | number }[]) => list.map((m) => m.id);

describe("moveModule — whole sequence", () => {
  it("moves a module down, shifting the ones in between up", () => {
    expect(ids(moveModule(seq, "t1", "a1"))).toEqual([
      "p1",
      "t2",
      "a1",
      "t1",
      "t3",
    ]);
  });

  it("moves a module up", () => {
    expect(ids(moveModule(seq, "t3", "p1"))).toEqual([
      "t1",
      "t3",
      "p1",
      "t2",
      "a1",
    ]);
  });

  it("does not mutate its input", () => {
    const before = ids(seq);
    moveModule(seq, "t1", "t3");
    expect(ids(seq)).toEqual(before);
  });

  it.each([
    ["dropped on itself", "t1", "t1"],
    ["an unknown dragged id", "zz", "t1"],
    ["an unknown target id", "t1", "zz"],
  ])("returns the same array for %s", (_case, active, over) => {
    expect(moveModule(seq, active, over)).toBe(seq);
  });
});

describe("moveModule — within a type's group", () => {
  it("trades places among that type only, leaving the others put", () => {
    // t3 dragged to the front of the theoretical group.
    expect(ids(moveModule(seq, "t3", "t1", true))).toEqual([
      "t3",
      "p1",
      "t1",
      "a1",
      "t2",
    ]);
  });

  it("moves down within the group", () => {
    expect(ids(moveModule(seq, "t1", "t2", true))).toEqual([
      "t2",
      "p1",
      "t1",
      "a1",
      "t3",
    ]);
  });

  it("ignores a drop onto another type", () => {
    expect(moveModule(seq, "t1", "p1", true)).toBe(seq);
  });

  it("matches numeric ids too", () => {
    const numeric = [
      { id: 1, type: T },
      { id: 2, type: T },
    ];
    expect(ids(moveModule(numeric, 2, 1, true))).toEqual([2, 1]);
  });
});

describe("numberModules", () => {
  it("counts theoretical and practical modules separately", () => {
    expect(numberModules(seq).map((m) => m.number)).toEqual([1, 1, 2, null, 3]);
  });

  it("gives no number to the other types", () => {
    expect(
      numberModules([
        { id: 1, type: A },
        { id: 2, type: "recurso" },
        { id: 3, type: "toString" },
      ]).map((m) => m.number),
    ).toEqual([null, null, null]);
  });

  it("keeps the other fields and handles an empty list", () => {
    expect(numberModules([{ id: 1, type: P, title: "x" }])).toEqual([
      { id: 1, type: P, title: "x", number: 1 },
    ]);
    expect(numberModules([])).toEqual([]);
  });
});

describe("planOrderUpdates", () => {
  const all = [
    { id: 10, order: 1 },
    { id: 11, order: 2 },
    { id: 12, order: 3 },
  ];

  it("writes nothing when the arrangement is unchanged", () => {
    expect(planOrderUpdates(all, [10, 11, 12])).toEqual([]);
  });

  it("writes only the modules that changed place", () => {
    expect(planOrderUpdates(all, [10, 12, 11])).toEqual([
      { id: 12, order: 2 },
      { id: 11, order: 3 },
    ]);
  });

  it("keeps an unlisted module where it is among the others", () => {
    // 11 is hidden from the page; the admin swaps 10 and 12 around it.
    expect(planOrderUpdates(all, [12, 10])).toEqual([
      { id: 12, order: 1 },
      { id: 10, order: 3 },
    ]);
  });

  it("numbers the course 1…n when modules share an order", () => {
    const tied = [
      { id: 1, order: 0 },
      { id: 2, order: 0 },
      { id: 3, order: 0 },
    ];
    expect(planOrderUpdates(tied, [3, 1, 2])).toEqual([
      { id: 3, order: 1 },
      { id: 1, order: 2 },
      { id: 2, order: 3 },
    ]);
    // Even "unchanged" gets distinct values, so the arrangement is pinned.
    expect(planOrderUpdates(tied, [1, 2, 3])).toHaveLength(3);
  });

  it("closes gaps left in the numbering", () => {
    expect(
      planOrderUpdates(
        [
          { id: 1, order: 1 },
          { id: 2, order: 5 },
        ],
        [1, 2],
      ),
    ).toEqual([{ id: 2, order: 2 }]);
  });

  it("matches ids across string and number", () => {
    expect(planOrderUpdates(all, ["12", "11", "10"])).toEqual([
      { id: 12, order: 1 },
      { id: 10, order: 3 },
    ]);
  });

  it("skips a listed module that no longer exists", () => {
    expect(planOrderUpdates(all, [12, 99, 11, 10])).toEqual([
      { id: 12, order: 1 },
      { id: 10, order: 3 },
    ]);
  });

  it("treats a missing order as needing a write", () => {
    expect(
      planOrderUpdates([{ id: 1 }, { id: 2, order: null }], [1, 2]),
    ).toEqual([
      { id: 1, order: 1 },
      { id: 2, order: 2 },
    ]);
  });

  it("handles an empty course", () => {
    expect(planOrderUpdates([], [1])).toEqual([]);
  });
});

describe("relationId", () => {
  it("reads a bare id or a populated document", () => {
    expect(relationId(4)).toBe("4");
    expect(relationId("4")).toBe("4");
    expect(relationId({ id: 4, title: "x" })).toBe("4");
  });

  it.each([null, undefined, "", {}, { id: null }])(
    "is null for %j",
    (value) => {
      expect(relationId(value)).toBeNull();
    },
  );
});

describe("joinsCourse", () => {
  it("is true for a module created in a course", () => {
    expect(joinsCourse("create", 4, undefined)).toBe(true);
  });

  it("is false for a module created without one yet", () => {
    expect(joinsCourse("create", undefined, undefined)).toBe(false);
    expect(joinsCourse("create", null, undefined)).toBe(false);
  });

  it("is true when a module gets its course later or changes course", () => {
    expect(joinsCourse("update", 4, null)).toBe(true);
    expect(joinsCourse("update", 5, 4)).toBe(true);
  });

  it("is false when the course stays the same, however it is written", () => {
    expect(joinsCourse("update", 4, 4)).toBe(false);
    expect(joinsCourse("update", "4", { id: 4 })).toBe(false);
  });

  it("is false for a save that does not mention the course", () => {
    // What the reorder sends: { order } alone.
    expect(joinsCourse("update", undefined, 4)).toBe(false);
  });
});

describe("placeholderModuleSlug", () => {
  it("is URL-safe and differs from one second to the next", () => {
    const a = placeholderModuleSlug(1_800_000_000_000);
    const b = placeholderModuleSlug(1_800_000_001_000);
    expect(a).toMatch(/^novo-modulo-[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});
