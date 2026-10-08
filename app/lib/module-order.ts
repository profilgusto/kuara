/**
 * lib/module-order.ts — the pure half of reordering a course's modules on its
 * own page.
 *
 * A course has one sequence of modules (the `order` field). The page shows it
 * whole ("Sequência") or split by type ("Grupos"); a drag in either view is a
 * change to that one sequence.
 */

type ModuleId = string | number;

interface TypedModule {
  id: ModuleId;
  type: string;
}

/**
 * The sequence after dragging `activeId` onto `overId`.
 *
 * With `withinType`, the drag happened inside one type's group: only modules
 * of that type trade places, each landing on a position one of them already
 * held, so every other module stays exactly where it was. A drop onto a
 * module of another type is ignored.
 *
 * Returns the same array when nothing moves.
 */
export function moveModule<T extends TypedModule>(
  sequence: T[],
  activeId: ModuleId,
  overId: ModuleId,
  withinType = false,
): T[] {
  const from = sequence.findIndex((m) => m.id === activeId);
  const to = sequence.findIndex((m) => m.id === overId);
  if (from === -1 || to === -1 || from === to) return sequence;

  if (!withinType) {
    const next = [...sequence];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  const type = sequence[from].type;
  if (sequence[to].type !== type) return sequence;

  const slots = sequence.flatMap((m, i) => (m.type === type ? [i] : []));
  const group = slots.map((i) => sequence[i]);
  const [moved] = group.splice(slots.indexOf(from), 1);
  group.splice(slots.indexOf(to), 0, moved);

  const next = [...sequence];
  slots.forEach((slot, i) => {
    next[slot] = group[i];
  });
  return next;
}

/**
 * The number shown on each card: theoretical and practical modules count
 * 1, 2, 3… separately, in sequence order; the other types have none.
 * Mirrors what `getCourse` does on the server, for a sequence being dragged.
 */
export function numberModules<T extends TypedModule>(
  sequence: T[],
): (T & { number: number | null })[] {
  const counters = new Map([
    ["modulo-teorico", 0],
    ["modulo-pratico", 0],
  ]);
  return sequence.map((m) => {
    const count = counters.get(m.type);
    if (count === undefined) return { ...m, number: null };
    counters.set(m.type, count + 1);
    return { ...m, number: count + 1 };
  });
}

export interface OrderUpdate {
  id: ModuleId;
  order: number;
}

/**
 * The `order` writes that make a new arrangement of the listed modules stick.
 *
 * `all` is every module of the course in its current order — including the
 * ones the page does not list (hidden, not linkable). `listed` is the new
 * arrangement of the ones it does. Unlisted modules keep their place among
 * the others; the listed ones fill the remaining places in the new order;
 * then the whole course is numbered 1…n. Numbering all of it, rather than
 * shuffling the existing values, is what makes this work when several modules
 * share an `order` (it defaults to 0).
 *
 * Only modules whose `order` actually changes are returned. A listed id that
 * is not in `all` (deleted meanwhile) is skipped.
 */
export function planOrderUpdates(
  all: { id: ModuleId; order?: number | null }[],
  listed: ModuleId[],
): OrderUpdate[] {
  const known = new Set(all.map((m) => String(m.id)));
  const queue = listed.map(String).filter((id) => known.has(id));
  const queued = new Set(queue);

  let next = 0;
  const updates: OrderUpdate[] = [];
  all.forEach((module, index) => {
    const id = queued.has(String(module.id)) ? queue[next++] : module.id;
    const current = all.find((m) => String(m.id) === String(id))!;
    if (current.order !== index + 1) {
      updates.push({ id: current.id, order: index + 1 });
    }
  });
  return updates;
}

/** The id behind a relationship value, which may arrive populated. */
export function relationId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    return relationId((value as { id?: unknown }).id);
  }
  return String(value);
}

/**
 * Whether a save should send the module to the end of its course: when it is
 * created in one, or moved into one. A save that leaves the course alone —
 * including one that does not mention it — keeps the order it has.
 */
export function joinsCourse(
  operation: "create" | "update",
  incomingCourse: unknown,
  currentCourse: unknown,
): boolean {
  const incoming = relationId(incomingCourse);
  if (incoming === null) return false;
  return operation === "create" || incoming !== relationId(currentCourse);
}

/**
 * Slug for a module created from the course page, before the admin gives it
 * a real one. The time-based suffix keeps two of them from colliding.
 */
export function placeholderModuleSlug(now: number = Date.now()): string {
  return `novo-modulo-${Math.floor(now / 1000).toString(36)}`;
}
