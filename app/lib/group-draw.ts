/**
 * lib/group-draw.ts — drawing an offer's students into work groups.
 *
 * Pure: the randomness comes in as a function, so a draw can be replayed in
 * a test. Shared by the "Adicionar grupos" modal (which previews how many
 * groups a draw would make) and the endpoint that performs it
 * (collections/StudentGroups.ts).
 */
import type { ClassGroup } from "./enrollment";

/** Draw among everybody, or separately inside each half of a split class. */
export const DRAW_SCOPES = ["all", "classGroup"] as const;
export type DrawScope = (typeof DRAW_SCOPES)[number];

export const MAX_GROUP_SIZE = 50;
export const MAX_GROUP_NAME_LENGTH = 80;

export interface DrawStudent {
  id: string | number;
  classGroup?: ClassGroup | null;
}

export interface PlannedGroup {
  name: string;
  memberIds: (string | number)[];
}

/**
 * Sizes of the groups for `count` students at about `size` each.
 *
 * The number of groups is the one that brings them closest to the size asked
 * for, and the students are spread as evenly as possible — so 33 students at
 * 4 each make eight groups, one of them with 5, rather than a ninth group of
 * a single student.
 */
export function groupSizes(count: number, size: number): number[] {
  if (count <= 0 || size <= 0) return [];
  const groups = Math.max(1, Math.round(count / size));
  const base = Math.floor(count / groups);
  const larger = count % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < larger ? 1 : 0));
}

/** "8 grupos: 1 de 5 e 7 de 4" — for the modal's preview line. */
export function describeGroupSizes(sizes: number[]): string {
  if (sizes.length === 0) return "nenhum grupo";
  const tally = new Map<number, number>();
  for (const size of sizes) tally.set(size, (tally.get(size) ?? 0) + 1);
  const parts = [...tally.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, groups]) => `${groups} de ${size}`);
  const total = `${sizes.length} grupo${sizes.length === 1 ? "" : "s"}`;
  return parts.length === 1 && sizes.length === 1
    ? `${total} de ${sizes[0]}`
    : `${total}: ${parts.join(" e ")}`;
}

/** Fisher–Yates, on a copy. `random` returns a number in [0, 1). */
export function shuffle<T>(
  items: T[],
  random: () => number = Math.random,
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The first free number for a generic name: one past the highest "Grupo N"
 * already in the offer, so a second draw never reuses a name.
 */
export function nextGroupNumber(existingNames: string[]): number {
  let highest = 0;
  for (const name of existingNames) {
    const match = /^\s*grupo\s+(\d+)\s*$/i.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

/**
 * The students split into the pools a draw runs in: one pool for everybody,
 * or one per subturma (A, then B, then the students in neither).
 */
export function drawPools<T extends DrawStudent>(
  students: T[],
  scope: DrawScope,
): T[][] {
  if (scope === "all") return students.length > 0 ? [students] : [];
  const pools = [
    students.filter((s) => s.classGroup === "A"),
    students.filter((s) => s.classGroup === "B"),
    students.filter((s) => s.classGroup !== "A" && s.classGroup !== "B"),
  ];
  return pools.filter((pool) => pool.length > 0);
}

/** Sizes of every group a draw would make, in order — for the preview. */
export function previewGroupSizes(
  students: DrawStudent[],
  size: number,
  scope: DrawScope,
): number[] {
  return drawPools(students, scope).flatMap((pool) =>
    groupSizes(pool.length, size),
  );
}

/**
 * Draws the students into new groups named "Grupo N", "Grupo N+1"…
 * Each pool (see `drawPools`) is shuffled and dealt out on its own, so with
 * the `classGroup` scope nobody lands in a group with the other subturma.
 */
export function planGroupDraw({
  students,
  size,
  scope,
  existingNames = [],
  random = Math.random,
}: {
  students: DrawStudent[];
  size: number;
  scope: DrawScope;
  existingNames?: string[];
  random?: () => number;
}): PlannedGroup[] {
  let number = nextGroupNumber(existingNames);
  const groups: PlannedGroup[] = [];

  for (const pool of drawPools(students, scope)) {
    const shuffled = shuffle(pool, random);
    let start = 0;
    for (const groupSize of groupSizes(pool.length, size)) {
      groups.push({
        name: `Grupo ${number++}`,
        memberIds: shuffled.slice(start, start + groupSize).map((s) => s.id),
      });
      start += groupSize;
    }
  }
  return groups;
}

/** Group size as typed: a whole number from 1 to MAX_GROUP_SIZE. */
export function parseGroupSize(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d{1,3}$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
  return Number.isInteger(number) && number >= 1 && number <= MAX_GROUP_SIZE
    ? number
    : null;
}

export type DrawRequest =
  | { ok: true; offer: string | number; size: number; scope: DrawScope }
  | { ok: false; error: string };

/** Checks the body of POST /api/student-groups/draw. */
export function validateDrawRequest(input: unknown): DrawRequest {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = input as Record<string, unknown>;

  const offer = raw.offer;
  if (
    !(typeof offer === "number" && Number.isInteger(offer)) &&
    !(typeof offer === "string" && offer.trim() !== "")
  ) {
    return { ok: false, error: "Oferta não informada." };
  }
  const size = parseGroupSize(raw.size);
  if (size === null) {
    return {
      ok: false,
      error: `Informe quantos discentes por grupo, de 1 a ${MAX_GROUP_SIZE}.`,
    };
  }
  const scope = DRAW_SCOPES.find((s) => s === raw.scope);
  if (!scope) return { ok: false, error: "Tipo de sorteio inválido." };

  return { ok: true, offer, size, scope };
}

export type GroupNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/** Checks a group name typed by hand against the offer's existing groups. */
export function validateGroupName(
  text: string,
  existingNames: string[] = [],
): GroupNameResult {
  const name = text.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Informe o nome do grupo." };
  if (name.length > MAX_GROUP_NAME_LENGTH) {
    return { ok: false, error: "O nome é longo demais." };
  }
  const key = name.toLocaleLowerCase("pt-BR");
  if (
    existingNames.some(
      (existing) =>
        existing.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR") === key,
    )
  ) {
    return { ok: false, error: `Já existe um grupo chamado “${name}”.` };
  }
  return { ok: true, name };
}
