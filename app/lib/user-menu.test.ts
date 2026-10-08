/**
 * user-menu.test.ts — which areas the top-bar menu offers to each role.
 */
import { describe, it, expect } from "vitest";
import { menuLinksForRole, roleLabel } from "./user-menu";

describe("menuLinksForRole", () => {
  const minhaArea = { label: "Minha área", href: "/minha-area" };

  it("gives the admin the account page, then the Payload panel as a full page load", () => {
    expect(menuLinksForRole("admin")).toEqual([
      minhaArea,
      { label: "Painel Payload", href: "/payload", external: true },
    ]);
  });

  it.each(["professor", "student", undefined, null, "", "root"])(
    "offers only the account page to the role %j",
    (role) => {
      expect(menuLinksForRole(role)).toEqual([minhaArea]);
    },
  );
});

describe("roleLabel", () => {
  it("names the three roles in Portuguese", () => {
    expect(roleLabel("admin")).toBe("Administrador");
    expect(roleLabel("professor")).toBe("Professor");
    expect(roleLabel("student")).toBe("Aluno");
  });

  it("has a neutral label for anything else", () => {
    expect(roleLabel(undefined)).toBe("Usuário");
    expect(roleLabel("root")).toBe("Usuário");
  });
});
