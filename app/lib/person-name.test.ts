/**
 * person-name.test.ts — title-casing names that SIGAA exports in capitals.
 */
import { describe, it, expect } from "vitest";
import { foldText, formatPersonName } from "./person-name";

describe("formatPersonName", () => {
  it("title-cases a name written in capitals", () => {
    expect(formatPersonName("FILIPE AUGUSTO SANTOS ROCHA")).toBe(
      "Filipe Augusto Santos Rocha",
    );
  });

  it("title-cases a name written in lower case", () => {
    expect(formatPersonName("eva moreira barberino")).toBe(
      "Eva Moreira Barberino",
    );
  });

  it("leaves a correctly written name alone", () => {
    expect(formatPersonName("Ana Clara de Souza")).toBe("Ana Clara de Souza");
  });

  it("keeps connectives in lower case in the middle of the name", () => {
    expect(formatPersonName("MARIA DAS GRAÇAS DE OLIVEIRA E SILVA")).toBe(
      "Maria das Graças de Oliveira e Silva",
    );
    expect(formatPersonName("LUDWIG VAN DER BERG")).toBe("Ludwig van der Berg");
  });

  it("capitalises a connective that comes first", () => {
    expect(formatPersonName("DA SILVA JOÃO")).toBe("Da Silva João");
  });

  it("handles accented capitals", () => {
    expect(formatPersonName("ÂNGELA CONCEIÇÃO ÁVILA")).toBe(
      "Ângela Conceição Ávila",
    );
  });

  it("capitalises both sides of a hyphen or apostrophe", () => {
    expect(formatPersonName("ANNE-MARIE D'ÁVILA")).toBe("Anne-Marie D'Ávila");
  });

  it("collapses stray whitespace", () => {
    expect(formatPersonName("  JOSÉ   DA  SILVA ")).toBe("José da Silva");
    expect(formatPersonName("   ")).toBe("");
  });
});

describe("foldText", () => {
  it("drops accents and case", () => {
    expect(foldText("Ângela CONCEIÇÃO")).toBe("angela conceicao");
    expect(foldText("Matrícula")).toBe("matricula");
  });
});
