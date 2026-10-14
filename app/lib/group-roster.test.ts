import { describe, it, expect } from "vitest";
import { abbreviateName, buildRoster, ungroupedNames } from "./group-roster";

describe("buildRoster", () => {
  const groups = [
    { id: 1, name: "Grupo 10" },
    { id: 2, name: "Grupo 2" },
    { id: 3, name: "Grupo 3" },
  ];

  it("orders groups naturally and members alphabetically", () => {
    const roster = buildRoster(groups, [
      { name: "Zélia Souza", group: 2 },
      { name: "Ana Lima", group: 2 },
      { name: "Bruno", group: 1 },
    ]);
    expect(roster.map((g) => g.name)).toEqual([
      "Grupo 2",
      "Grupo 3",
      "Grupo 10",
    ]);
    expect(roster[0].members).toEqual(["Ana Lima", "Zélia Souza"]);
  });

  it("keeps empty groups and ignores students without a group", () => {
    const roster = buildRoster(groups, [
      { name: "Ana", group: null },
      { name: "Bia" },
      { name: "Caio", group: 99 },
    ]);
    expect(roster).toHaveLength(3);
    expect(roster.every((g) => g.members.length === 0)).toBe(true);
  });
});

describe("abbreviateName", () => {
  it("keeps first and last in full and abbreviates the rest", () => {
    expect(abbreviateName("Filipe Augusto Souza Rocha")).toBe(
      "Filipe A. S. Rocha",
    );
  });
  it("drops particles between the names", () => {
    expect(abbreviateName("Maria da Silva dos Santos")).toBe("Maria S. Santos");
  });
  it("leaves one or two names alone and tidies spaces", () => {
    expect(abbreviateName("  Ana ")).toBe("Ana");
    expect(abbreviateName("Ana  Lima")).toBe("Ana Lima");
  });
});

describe("ungroupedNames", () => {
  const groups = [{ id: 1 }, { id: 2 }];
  it("lists, abbreviated and sorted, the students in no group", () => {
    expect(
      ungroupedNames(groups, [
        { name: "Zélia Maria Souza", group: null },
        { name: "Ana Lima" },
        { name: "Bia Costa", group: 1 },
      ]),
    ).toEqual(["Ana Lima", "Zélia M. Souza"]);
  });
  it("counts a student of an unknown group as ungrouped", () => {
    expect(ungroupedNames(groups, [{ name: "Caio Reis", group: 99 }])).toEqual([
      "Caio Reis",
    ]);
  });
  it("is empty when everyone has a group", () => {
    expect(ungroupedNames(groups, [{ name: "Ana", group: 2 }])).toEqual([]);
  });
});
