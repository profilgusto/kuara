/**
 * lib/group-roster.ts — the public roster of an offer's work groups: group
 * names and the abbreviated names of their members, and nothing else (no
 * matrícula, no full name).
 */

export interface RosterGroup {
  id: string | number;
  name: string;
  members: string[];
}

/** Particles that are not part of a name proper: "Maria da Silva" → "Maria Silva". */
const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * "Filipe Augusto Souza Rocha" → "Filipe A. S. Rocha": first and last names
 * in full, the ones between them as initials. Particles (da, de, dos…) are
 * dropped. A single name is kept as it is.
 */
export function abbreviateName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(
      (part, i, all) =>
        i === 0 ||
        i === all.length - 1 ||
        !PARTICLES.has(part.toLocaleLowerCase("pt-BR")),
    );
  if (parts.length <= 2) return parts.join(" ");
  const middle = parts
    .slice(1, -1)
    .map((part) => `${part.charAt(0).toLocaleUpperCase("pt-BR")}.`);
  return [parts[0], ...middle, parts[parts.length - 1]].join(" ");
}

const collator = new Intl.Collator("pt-BR", { numeric: true });

/**
 * Groups the enrolled students under their group. Groups come out ordered by
 * name ("Grupo 2" before "Grupo 10"), members alphabetically; a group with
 * no members is kept, a student with no group is left out.
 */
export function buildRoster(
  groups: { id: string | number; name: string }[],
  students: { name: string; group?: string | number | null }[],
): RosterGroup[] {
  const byId = new Map<string, RosterGroup>(
    groups.map((g) => [String(g.id), { id: g.id, name: g.name, members: [] }]),
  );
  for (const student of students) {
    if (student.group === null || student.group === undefined) continue;
    byId.get(String(student.group))?.members.push(abbreviateName(student.name));
  }
  const roster = [...byId.values()];
  for (const group of roster) group.members.sort(collator.compare);
  return roster.sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * Abbreviated names of the students who are in no group of the offer, in
 * alphabetical order. A student pointing at a group that is not among
 * `groups` counts as having none.
 */
export function ungroupedNames(
  groups: { id: string | number }[],
  students: { name: string; group?: string | number | null }[],
): string[] {
  const known = new Set(groups.map((g) => String(g.id)));
  return students
    .filter(
      (s) =>
        s.group === null ||
        s.group === undefined ||
        !known.has(String(s.group)),
    )
    .map((s) => abbreviateName(s.name))
    .sort(collator.compare);
}
