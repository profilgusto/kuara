import { describe, it, expect } from "vitest";
import {
  buildCoursePatch,
  draftFromCourse,
  formatWorkload,
  saveErrorMessage,
  type CourseDraft,
} from "./course-edit";

const draft: CourseDraft = {
  title: "Robótica Móvel",
  code: "EMT0042",
  summary: "Cinemática e controle.",
  theoretical: "30",
  practical: "15",
};

describe("formatWorkload", () => {
  it("joins both parts", () => {
    expect(formatWorkload({ theoretical: 30, practical: 15 })).toBe(
      "30h teórica · 15h prática",
    );
  });

  it("shows only the part that has hours", () => {
    expect(formatWorkload({ theoretical: 30 })).toBe("30h teórica");
    expect(formatWorkload({ practical: 15, theoretical: null })).toBe(
      "15h prática",
    );
  });

  it("treats zero hours as none instead of printing a 0", () => {
    expect(formatWorkload({ theoretical: 30, practical: 0 })).toBe(
      "30h teórica",
    );
    expect(formatWorkload({ theoretical: 0, practical: 0 })).toBe("");
  });

  it("is empty without a workload", () => {
    expect(formatWorkload(undefined)).toBe("");
    expect(formatWorkload(null)).toBe("");
    expect(formatWorkload({})).toBe("");
  });
});

describe("buildCoursePatch", () => {
  it("sends only the field being edited, trimmed", () => {
    expect(buildCoursePatch("title", { ...draft, title: "  Nova  " })).toEqual({
      ok: true,
      patch: { title: "Nova" },
    });
    expect(buildCoursePatch("code", { ...draft, code: " EMT1 " })).toEqual({
      ok: true,
      patch: { code: "EMT1" },
    });
  });

  it("refuses a blank title or code", () => {
    expect(buildCoursePatch("title", { ...draft, title: "   " }).ok).toBe(
      false,
    );
    expect(buildCoursePatch("code", { ...draft, code: "" }).ok).toBe(false);
  });

  it("clears the summary when it is left blank", () => {
    expect(buildCoursePatch("summary", { ...draft, summary: " \n " })).toEqual({
      ok: true,
      patch: { summary: null },
    });
  });

  it("keeps line breaks inside a summary", () => {
    expect(buildCoursePatch("summary", { ...draft, summary: "a\nb" })).toEqual({
      ok: true,
      patch: { summary: "a\nb" },
    });
  });

  it("parses hours, with blank meaning none", () => {
    expect(
      buildCoursePatch("workload", {
        ...draft,
        theoretical: " 60 ",
        practical: "",
      }),
    ).toEqual({
      ok: true,
      patch: { workload: { theoretical: 60, practical: null } },
    });
  });

  it("accepts zero hours", () => {
    expect(
      buildCoursePatch("workload", { ...draft, theoretical: "0" }),
    ).toEqual({
      ok: true,
      patch: { workload: { theoretical: 0, practical: 15 } },
    });
  });

  it.each(["-5", "1.5", "1,5", "30h", "abc", "1e2"])(
    "refuses %s as hours",
    (text) => {
      expect(
        buildCoursePatch("workload", { ...draft, practical: text }).ok,
      ).toBe(false);
    },
  );
});

describe("draftFromCourse", () => {
  it("turns saved values into text", () => {
    expect(
      draftFromCourse({
        title: "T",
        code: "C",
        summary: "S",
        workload: { theoretical: 30, practical: 0 },
      }),
    ).toEqual({
      title: "T",
      code: "C",
      summary: "S",
      theoretical: "30",
      practical: "0",
    });
  });

  it("uses blanks for what is missing", () => {
    expect(draftFromCourse({ title: "T", code: "C" })).toEqual({
      title: "T",
      code: "C",
      summary: "",
      theoretical: "",
      practical: "",
    });
    expect(
      draftFromCourse({
        title: "T",
        code: "C",
        summary: null,
        workload: { theoretical: null },
      }).theoretical,
    ).toBe("");
  });
});

describe("saveErrorMessage", () => {
  it("points at the session when the server refuses access", () => {
    expect(saveErrorMessage(401, null)).toMatch(/sessão/);
    expect(saveErrorMessage(403, { errors: [{ message: "x" }] })).toMatch(
      /sessão/,
    );
  });

  it("names a duplicated code", () => {
    const body = {
      errors: [
        {
          message: "The following field is invalid: code",
          data: { errors: [{ message: "Value must be unique", path: "code" }] },
        },
      ],
    };
    expect(saveErrorMessage(400, body)).toBe(
      "Já existe uma disciplina com este código.",
    );
  });

  it("passes on any other reason the server gives", () => {
    expect(saveErrorMessage(400, { errors: [{ message: "Boom" }] })).toBe(
      "Não foi possível salvar: Boom",
    );
  });

  it.each([null, undefined, {}, { errors: [] }, "texto", { errors: [{}] }])(
    "falls back to a generic message for %j",
    (body) => {
      expect(saveErrorMessage(500, body)).toBe(
        "Não foi possível salvar. Tente novamente.",
      );
    },
  );
});
