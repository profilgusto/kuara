/**
 * lib/person-name.ts — proper names in Portuguese title case.
 *
 * SIGAA exports many names in ALL CAPS. `formatPersonName` gives each name
 * and surname a single leading capital ("EVA MOREIRA BARBERINO" → "Eva
 * Moreira Barberino") and keeps the connectives ("de", "da", "e"…) in lower
 * case, except as the first word.
 */

/** Connectives that stay in lower case in the middle of a name. */
const CONNECTIVES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "du",
  "del",
  "della",
  "van",
  "von",
  "der",
  "di",
  "la",
  "le",
]);

/** Capitalises a word, respecting inner separators (hyphen, apostrophe). */
function capitalize(word: string): string {
  return word.replace(
    /[\p{L}\p{N}]+/gu,
    (part) =>
      part.charAt(0).toLocaleUpperCase("pt-BR") +
      part.slice(1).toLocaleLowerCase("pt-BR"),
  );
}

export function formatPersonName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, i) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (i > 0 && CONNECTIVES.has(lower)) return lower;
      return capitalize(word);
    })
    .join(" ");
}

/** Accent- and case-insensitive form, for searching and sorting. */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
