/**
 * grades.test.ts — which score belongs to which student, and how a grade is
 * written in each display mode.
 */
import { describe, it, expect } from "vitest";
import {
  formatGrade,
  formatTotal,
  gradeTone,
  percentageFor,
  pointsFor,
  totalFor,
  totalTone,
  completedTasksFor,
  gradeInputValue,
  groupPercentage,
  groupTaskState,
  toggleTask,
  validateSetTask,
  nextGradeCell,
  parseGradeInput,
  validateSetScores,
  type ScoreRow,
} from "./grades";

const p1 = { id: 1 };
const seminar = { id: 2 };

const scores: ScoreRow[] = [
  { id: 100, assessmentId: 1, enrollmentId: 10, percentage: 80 },
  { id: 101, assessmentId: 1, enrollmentId: 11, percentage: 55.5 },
  { id: 102, assessmentId: 2, enrollmentId: 10, percentage: 90 },
  { id: 103, assessmentId: 2, enrollmentId: 12, percentage: 0 },
];

describe("percentageFor", () => {
  it("finds a student's score in an assessment", () => {
    expect(percentageFor({ id: 10 }, p1, scores)).toBe(80);
    expect(percentageFor({ id: 11 }, p1, scores)).toBe(55.5);
    expect(percentageFor({ id: 10 }, seminar, scores)).toBe(90);
  });

  it("tells a grade of zero from no grade", () => {
    expect(percentageFor({ id: 12 }, seminar, scores)).toBe(0);
    expect(percentageFor({ id: 12 }, p1, scores)).toBeNull();
  });

  it("does not depend on the group the student is in now", () => {
    // The grade belongs to the student: moving to another group, or to
    // none, changes nothing.
    const inGroup = { id: 10, groupId: 7 };
    const moved = { id: 10, groupId: 8 };
    const alone = { id: 10, groupId: null };
    for (const student of [inGroup, moved, alone]) {
      expect(percentageFor(student, seminar, scores)).toBe(90);
    }
  });

  it("gives a newcomer nothing from the group they joined", () => {
    expect(percentageFor({ id: 11 }, seminar, scores)).toBeNull();
  });

  it("matches ids whether they come as numbers or as text", () => {
    expect(percentageFor({ id: "10" }, { id: "1" }, scores)).toBe(80);
  });
});

describe("pointsFor", () => {
  it("is the share of the assessment's weight", () => {
    expect(pointsFor(100, 2.5)).toBe(2.5);
    expect(pointsFor(50, 4)).toBe(2);
    expect(pointsFor(0, 4)).toBe(0);
  });
});

describe("formatGrade", () => {
  it("shows points with one decimal", () => {
    expect(formatGrade(100, 2.5, "points")).toBe("2.5");
    expect(formatGrade(80, 4, "points")).toBe("3.2");
    expect(formatGrade(0, 4, "points")).toBe("0.0");
    expect(formatGrade(100, 10, "points")).toBe("10.0");
  });

  it("rounds points to the nearest tenth", () => {
    expect(formatGrade(87, 2.5, "points")).toBe("2.2"); // 2.175
    expect(formatGrade(90, 2.5, "points")).toBe("2.3"); // 2.25
  });

  it("shows the percentage, whole when it is whole", () => {
    expect(formatGrade(87, 2.5, "percent")).toBe("87%");
    expect(formatGrade(100, 2.5, "percent")).toBe("100%");
    expect(formatGrade(0, 2.5, "percent")).toBe("0%");
    expect(formatGrade(55.5, 2.5, "percent")).toBe("55.5%");
    expect(formatGrade(33.333, 2.5, "percent")).toBe("33.3%");
  });

  it("shows a dash for no grade, in either mode", () => {
    expect(formatGrade(null, 2.5, "points")).toBe("—");
    expect(formatGrade(null, 2.5, "percent")).toBe("—");
  });
});

describe("gradeTone", () => {
  it("passes at 60% of the assessment, fails below it", () => {
    expect(gradeTone(60)).toBe("pass");
    expect(gradeTone(100)).toBe("pass");
    expect(gradeTone(59.9)).toBe("fail");
    expect(gradeTone(0)).toBe("fail");
  });

  it("has no colour for a missing grade", () => {
    expect(gradeTone(null)).toBeNull();
  });
});

describe("totalFor", () => {
  const p1 = {
    id: 1,
    scoredBy: "student" as const,
    mode: "graded" as const,
    tasks: [],
    weight: 4,
    category: "regular" as const,
  };
  const tf = {
    id: 2,
    scoredBy: "student" as const,
    mode: "graded" as const,
    tasks: [],
    weight: 6,
    category: "regular" as const,
  };
  const bonus = {
    id: 3,
    scoredBy: "student" as const,
    mode: "graded" as const,
    tasks: [],
    weight: 1,
    category: "extra" as const,
  };
  const seminar = {
    id: 4,
    scoredBy: "group" as const,
    mode: "graded" as const,
    tasks: [],
    weight: 2,
    category: "regular" as const,
  };
  const all = [p1, tf, bonus];
  const score = (
    assessmentId: number,
    percentage: number,
    enrollmentId = 10,
  ) => ({
    id: assessmentId * 100 + enrollmentId,
    assessmentId,
    enrollmentId,
    percentage,
  });
  const ana = { id: 10 };

  it("adds up the points obtained, against the points handed out so far", () => {
    // 50% of 4.0 = 2.0, with only P1 graded.
    expect(totalFor(ana, all, [score(1, 50)])).toEqual({
      points: 2,
      distributed: 4,
      percentage: 50,
      graded: true,
    });
  });

  it("becomes the final result once everything is graded", () => {
    // 50% of 4.0 + 80% of 6.0 = 6.8 out of 10.0.
    const total = totalFor(ana, [p1, tf], [score(1, 50), score(2, 80)]);
    expect(total.points).toBeCloseTo(6.8);
    expect(total.distributed).toBe(10);
    expect(total.percentage).toBeCloseTo(68);
  });

  it("counts bonus points in the sum, but not in what was handed out", () => {
    // 50% of 4.0 + 100% of the 1.0 bonus = 3.0, measured against 4.0.
    const total = totalFor(ana, all, [score(1, 50), score(3, 100)]);
    expect(total.points).toBe(3);
    expect(total.distributed).toBe(4);
    expect(total.percentage).toBe(75);
  });

  it("can go past 100% with bonus points", () => {
    const total = totalFor(ana, all, [score(1, 100), score(3, 100)]);
    expect(total.percentage).toBe(125);
  });

  it("has no percentage with bonus points only", () => {
    expect(totalFor(ana, all, [score(3, 100)])).toEqual({
      points: 1,
      distributed: 0,
      percentage: null,
      graded: true,
    });
  });

  it("is empty for a student with no grades", () => {
    expect(totalFor(ana, all, [score(1, 50, 99)])).toEqual({
      points: 0,
      distributed: 0,
      percentage: null,
      graded: false,
    });
  });

  it("counts a zero as handed out", () => {
    const total = totalFor(ana, [p1, tf], [score(1, 0), score(2, 100)]);
    expect(total.points).toBe(6);
    expect(total.distributed).toBe(10);
  });
});

describe("totalTone", () => {
  const total = (points: number, distributed: number, graded = true) => ({
    points,
    distributed,
    percentage: distributed > 0 ? (points / distributed) * 100 : null,
    graded,
  });

  it("passes at 60% of the points handed out so far", () => {
    expect(totalTone(total(2.4, 4))).toBe("pass");
    expect(totalTone(total(6, 10))).toBe("pass");
    expect(totalTone(total(2.3, 4))).toBe("fail");
    expect(totalTone(total(5.9, 10))).toBe("fail");
  });

  it("is not fooled by floating-point sums that land just under", () => {
    // 60% of 0.7 + 60% of 0.2 + 60% of 0.1, added as floats.
    const points = 0.6 * 0.7 + 0.6 * 0.2 + 0.6 * 0.1;
    expect(totalTone(total(points, 0.7 + 0.2 + 0.1))).toBe("pass");
  });

  it("has no colour without grades, or with bonus points only", () => {
    expect(totalTone(total(0, 0, false))).toBeNull();
    expect(totalTone(total(1, 0))).toBeNull();
  });
});

describe("formatTotal", () => {
  const total = (points: number, distributed: number, graded = true) => ({
    points,
    distributed,
    percentage: distributed > 0 ? (points / distributed) * 100 : null,
    graded,
  });

  it("shows the points obtained, with one decimal", () => {
    expect(formatTotal(total(6.8, 10), "points")).toBe("6.8");
    expect(formatTotal(total(0, 4), "points")).toBe("0.0");
    expect(formatTotal(total(1, 0), "points")).toBe("1.0");
  });

  it("shows the share of the points handed out", () => {
    expect(formatTotal(total(3, 4), "percent")).toBe("75%");
    expect(formatTotal(total(2, 3), "percent")).toBe("66.7%");
  });

  it("shows a dash where there is nothing to show", () => {
    expect(formatTotal(total(0, 0, false), "points")).toBe("—");
    expect(formatTotal(total(0, 0, false), "percent")).toBe("—");
    expect(formatTotal(total(1, 0), "percent")).toBe("—");
  });
});

describe("parseGradeInput", () => {
  it("reads a percentage, with dot or comma, with or without the sign", () => {
    expect(parseGradeInput("87", 2.5, "percent")).toEqual({
      ok: true,
      percentage: 87,
    });
    expect(parseGradeInput(" 55,5 ", 2.5, "percent")).toEqual({
      ok: true,
      percentage: 55.5,
    });
    expect(parseGradeInput("100%", 2.5, "percent")).toEqual({
      ok: true,
      percentage: 100,
    });
    expect(parseGradeInput("0", 2.5, "percent")).toEqual({
      ok: true,
      percentage: 0,
    });
  });

  it("reads points and turns them into the percentage of the assessment", () => {
    expect(parseGradeInput("2.5", 2.5, "points")).toEqual({
      ok: true,
      percentage: 100,
    });
    expect(parseGradeInput("1", 4, "points")).toEqual({
      ok: true,
      percentage: 25,
    });
    expect(parseGradeInput("0", 4, "points")).toEqual({
      ok: true,
      percentage: 0,
    });
  });

  it("gives the typed points back when shown again", () => {
    // 2.2 of 2.5, or 1.1 of 3: neither is a round percentage.
    for (const [points, weight] of [
      ["2.2", 2.5],
      ["1.1", 3],
      ["0.7", 0.9],
      ["3.3", 7],
    ] as const) {
      const parsed = parseGradeInput(points, weight, "points");
      expect(parsed.ok && parsed.percentage !== null).toBe(true);
      if (parsed.ok && parsed.percentage !== null) {
        expect(formatGrade(parsed.percentage, weight, "points")).toBe(points);
        expect(gradeInputValue(parsed.percentage, weight, "points")).toBe(
          points,
        );
      }
    }
  });

  it("treats a blank cell as clearing the grade", () => {
    expect(parseGradeInput("", 2.5, "percent")).toEqual({
      ok: true,
      percentage: null,
    });
    expect(parseGradeInput("   ", 2.5, "points")).toEqual({
      ok: true,
      percentage: null,
    });
  });

  it("refuses more than the assessment is worth", () => {
    expect(parseGradeInput("101", 2.5, "percent").ok).toBe(false);
    expect(parseGradeInput("2.6", 2.5, "points")).toEqual({
      ok: false,
      error: "Esta avaliação vale no máximo 2.5.",
    });
    expect(parseGradeInput("2.5", 2.5, "points").ok).toBe(true);
  });

  it.each(["abc", "-1", "1e2", "1.234", "1..2", "8 7", "1000"])(
    "refuses %j",
    (text) => {
      expect(parseGradeInput(text, 10, "percent").ok).toBe(false);
      expect(parseGradeInput(text, 10, "points").ok).toBe(false);
    },
  );
});

describe("gradeInputValue", () => {
  it("is the grade as shown, without the sign", () => {
    expect(gradeInputValue(87, 2.5, "percent")).toBe("87");
    expect(gradeInputValue(55.5, 2.5, "percent")).toBe("55.5");
    expect(gradeInputValue(80, 4, "points")).toBe("3.2");
  });

  it("is empty for no grade", () => {
    expect(gradeInputValue(null, 4, "points")).toBe("");
    expect(gradeInputValue(null, 4, "percent")).toBe("");
  });
});

describe("groupPercentage", () => {
  const score = (enrollmentId: number, percentage: number) => ({
    id: enrollmentId,
    assessmentId: 2,
    enrollmentId,
    percentage,
  });
  const members = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("is the grade every member holds", () => {
    expect(
      groupPercentage(members, { id: 2 }, [
        score(1, 80),
        score(2, 80),
        score(3, 80),
      ]),
    ).toEqual({ kind: "same", percentage: 80 });
  });

  it("is nothing when nobody has a grade", () => {
    expect(groupPercentage(members, { id: 2 }, [])).toEqual({ kind: "none" });
    expect(groupPercentage([], { id: 2 }, [score(1, 80)])).toEqual({
      kind: "none",
    });
  });

  it("is mixed when the members' grades differ", () => {
    expect(
      groupPercentage(members, { id: 2 }, [
        score(1, 80),
        score(2, 80),
        score(3, 50),
      ]),
    ).toEqual({ kind: "mixed" });
  });

  it("is mixed when only some members have a grade", () => {
    // A newcomer with no grade yet: the group no longer has one grade.
    expect(
      groupPercentage(members, { id: 2 }, [score(1, 80), score(2, 80)]),
    ).toEqual({ kind: "mixed" });
  });

  it("ignores grades in other assessments, and of other students", () => {
    expect(groupPercentage(members, { id: 9 }, [score(1, 80)])).toEqual({
      kind: "none",
    });
    expect(
      groupPercentage([{ id: 1 }], { id: 2 }, [score(1, 80), score(7, 10)]),
    ).toEqual({ kind: "same", percentage: 80 });
  });
});

describe("nextGradeCell", () => {
  const columns = [
    ["p1:ana", "p1:bia", "p1:caio"],
    ["tf:ana", "tf:bia", "tf:caio"],
  ];

  it("goes down the same assessment, to the next student", () => {
    expect(nextGradeCell(columns, "p1:ana", 1)).toBe("p1:bia");
    expect(nextGradeCell(columns, "p1:bia", 1)).toBe("p1:caio");
  });

  it("wraps from the last student to the top of the next assessment", () => {
    expect(nextGradeCell(columns, "p1:caio", 1)).toBe("tf:ana");
  });

  it("goes back up with Shift+Tab, across assessments too", () => {
    expect(nextGradeCell(columns, "p1:bia", -1)).toBe("p1:ana");
    expect(nextGradeCell(columns, "tf:ana", -1)).toBe("p1:caio");
  });

  it("stops at either end, and for a cell it does not know", () => {
    expect(nextGradeCell(columns, "tf:caio", 1)).toBeNull();
    expect(nextGradeCell(columns, "p1:ana", -1)).toBeNull();
    expect(nextGradeCell(columns, "zz", 1)).toBeNull();
    expect(nextGradeCell([], "p1:ana", 1)).toBeNull();
  });

  it("skips an assessment with no cells", () => {
    expect(nextGradeCell([["a"], [], ["b"]], "a", 1)).toBe("b");
  });
});

describe("validateSetScores", () => {
  const valid = {
    offer: 7,
    activity: 3,
    enrollments: [10, 11],
    percentage: 87.5,
  };

  it("accepts a complete request", () => {
    expect(validateSetScores(valid)).toEqual({ ok: true, ...valid });
  });

  it("accepts null, which clears the grade", () => {
    const result = validateSetScores({ ...valid, percentage: null });
    expect(result.ok && result.percentage).toBeNull();
  });

  it("counts a student listed twice once", () => {
    const result = validateSetScores({ ...valid, enrollments: [10, "10", 11] });
    expect(result.ok && result.enrollments).toHaveLength(2);
  });

  it.each([
    [null],
    ["x"],
    [{ ...valid, offer: undefined }],
    [{ ...valid, activity: "" }],
    [{ ...valid, enrollments: [] }],
    [{ ...valid, enrollments: "10" }],
    [{ ...valid, enrollments: [10, null] }],
    [{ ...valid, enrollments: Array.from({ length: 201 }, (_, i) => i) }],
    [{ ...valid, percentage: -1 }],
    [{ ...valid, percentage: 100.1 }],
    [{ ...valid, percentage: "87" }],
    [{ ...valid, percentage: NaN }],
    [{ ...valid, percentage: undefined }],
  ])("refuses %j", (body) => {
    expect(validateSetScores(body).ok).toBe(false);
  });
});

describe("an assessment graded by tasks", () => {
  const tasks = [
    { id: "t1", name: "Lista 1" },
    { id: "t2", name: "Lista 2" },
    { id: "t3", name: "Lista 3" },
    { id: "t4", name: "Lista 4" },
  ];
  const checklist = { id: 5, mode: "checklist" as const, tasks };
  const done = (enrollmentId: number, ...ids: string[]) => ({
    id: enrollmentId,
    assessmentId: 5,
    enrollmentId,
    // What a stale stored percentage would be: it must not be trusted.
    percentage: 12,
    completedTaskIds: ids,
  });

  it("is worth the share of the tasks done", () => {
    expect(percentageFor({ id: 1 }, checklist, [done(1, "t1")])).toBe(25);
    expect(percentageFor({ id: 1 }, checklist, [done(1, "t1", "t3")])).toBe(50);
    expect(
      percentageFor({ id: 1 }, checklist, [done(1, "t1", "t2", "t3", "t4")]),
    ).toBe(100);
  });

  it("is zero, not missing, for a student who has done none", () => {
    expect(percentageFor({ id: 1 }, checklist, [])).toBe(0);
    expect(percentageFor({ id: 1 }, checklist, [done(1)])).toBe(0);
    expect(percentageFor({ id: 2 }, checklist, [done(1, "t1")])).toBe(0);
  });

  it("has no grade while it has no tasks", () => {
    expect(
      percentageFor({ id: 1 }, { id: 5, mode: "checklist", tasks: [] }, [
        done(1, "t1"),
      ]),
    ).toBeNull();
  });

  it("does not count a task that no longer exists", () => {
    expect(percentageFor({ id: 1 }, checklist, [done(1, "t1", "gone")])).toBe(
      25,
    );
  });

  it("follows the task list: more tasks, smaller share each", () => {
    const longer = {
      ...checklist,
      tasks: [...tasks, { id: "t5", name: "Lista 5" }],
    };
    expect(percentageFor({ id: 1 }, longer, [done(1, "t1")])).toBe(20);
  });

  it("feeds the total like any other grade", () => {
    const total = totalFor(
      { id: 1 },
      [{ ...checklist, weight: 2, category: "regular" as const }],
      [done(1, "t1", "t2", "t3")],
    );
    expect(total).toMatchObject({ points: 1.5, distributed: 2, graded: true });
  });

  it("lists what a student has done", () => {
    expect([
      ...completedTasksFor({ id: 1 }, checklist, [done(1, "t2", "t4")]),
    ]).toEqual(["t2", "t4"]);
    expect(completedTasksFor({ id: 9 }, checklist, [done(1, "t2")]).size).toBe(
      0,
    );
  });

  it("tells whether a whole group, none of it, or part of it did a task", () => {
    const members = [{ id: 1 }, { id: 2 }];
    const scores = [done(1, "t1", "t2"), done(2, "t1")];
    expect(groupTaskState(members, checklist, "t1", scores)).toBe("all");
    expect(groupTaskState(members, checklist, "t2", scores)).toBe("some");
    expect(groupTaskState(members, checklist, "t3", scores)).toBe("none");
    expect(groupTaskState([], checklist, "t1", scores)).toBe("none");
  });
});

describe("toggleTask", () => {
  it("adds a task done and removes one undone", () => {
    expect(toggleTask(["t1"], "t2", true)).toEqual(["t1", "t2"]);
    expect(toggleTask(["t1", "t2"], "t1", false)).toEqual(["t2"]);
  });

  it("does nothing the second time", () => {
    expect(toggleTask(["t1"], "t1", true)).toEqual(["t1"]);
    expect(toggleTask(["t1"], "t9", false)).toEqual(["t1"]);
  });

  it("leaves the list it was given alone", () => {
    const before = ["t1"];
    toggleTask(before, "t2", true);
    expect(before).toEqual(["t1"]);
  });
});

describe("validateSetTask", () => {
  const valid = {
    offer: 7,
    activity: 5,
    task: "t1",
    enrollments: [10],
    done: true,
  };

  it("accepts a complete request", () => {
    expect(validateSetTask(valid)).toEqual({ ok: true, ...valid });
    expect(validateSetTask({ ...valid, done: false }).ok).toBe(true);
  });

  it("counts a student listed twice once", () => {
    const result = validateSetTask({ ...valid, enrollments: [10, "10", 11] });
    expect(result.ok && result.enrollments).toHaveLength(2);
  });

  it.each([
    [null],
    [{ ...valid, offer: undefined }],
    [{ ...valid, activity: "" }],
    [{ ...valid, task: "" }],
    [{ ...valid, task: 3 }],
    [{ ...valid, enrollments: [] }],
    [{ ...valid, enrollments: [null] }],
    [{ ...valid, done: "sim" }],
    [{ ...valid, done: undefined }],
  ])("refuses %j", (body) => {
    expect(validateSetTask(body).ok).toBe(false);
  });
});
