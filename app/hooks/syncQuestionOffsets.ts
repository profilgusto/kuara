import type { CollectionAfterChangeHook } from "payload";

type QuestionType = "example" | "exercise" | "problem" | "definition";
type QuestionCounts = Partial<Record<QuestionType, number>>;

const QUESTION_TYPES: QuestionType[] = [
  "exercise",
  "example",
  "problem",
  "definition",
];

// Prevents re-entrancy across concurrent async calls for the same course.
// This is the primary loop guard; context propagation from payload.update()
// is a secondary guard that may or may not work depending on Payload version.
const processingCourses = new Set<string | number>();

function countQuestions(content: string): Record<QuestionType, number> {
  const counts: Record<QuestionType, number> = {
    exercise: 0,
    example: 0,
    problem: 0,
    definition: 0,
  };
  for (const type of QUESTION_TYPES) {
    const regex = new RegExp(`<Question[^>]*type=["']${type}["']`, "g");
    counts[type] = content.match(regex)?.length ?? 0;
  }
  return counts;
}

/**
 * After a Module is published, recomputes course-wide question starting offsets
 * for all modules in the same course and persists them to `questionOffsets`.
 *
 * The computation runs fire-and-forget so it never blocks the save operation.
 * Re-entrancy is prevented by `processingCourses` (primary) and
 * `context.skipQuestionOffsets` (secondary).
 */
export const syncQuestionOffsets: CollectionAfterChangeHook = async ({
  doc,
  req,
  context,
}) => {
  // Secondary guard: triggered by our own internal payload.update() calls
  if (context?.skipQuestionOffsets) return doc;

  // Only recompute when a module is in published state
  if (doc._status !== "published") return doc;

  const courseId =
    doc.course && typeof doc.course === "object" ? doc.course.id : doc.course;
  if (!courseId) return doc;

  // Primary guard: synchronously claim the course before the async work starts
  if (processingCourses.has(courseId)) return doc;
  processingCourses.add(courseId);

  // Fire-and-forget: offset recompute runs in the background so the save
  // response is not blocked by the N module update calls that follow.
  void (async () => {
    try {
      const modulesResult = await req.payload.find({
        collection: "modules",
        where: { course: { equals: courseId } },
        sort: "order",
        limit: 200,
        depth: 0,
        overrideAccess: true,
      });

      // Walk the module sequence and accumulate running totals.
      // Only published modules contribute to the visible numbering.
      const running: Record<QuestionType, number> = {
        exercise: 0,
        example: 0,
        problem: 0,
        definition: 0,
      };

      const updates: Array<{ id: string | number; offsets: QuestionCounts }> =
        [];

      for (const mod of modulesResult.docs as {
        id: string | number;
        _status?: string | null;
        content?: string | null;
      }[]) {
        updates.push({ id: mod.id, offsets: { ...running } });

        if (mod._status === "published" && mod.content) {
          const counts = countQuestions(mod.content);
          for (const type of QUESTION_TYPES) {
            running[type] += counts[type];
          }
        }
      }

      await Promise.all(
        updates.map(({ id, offsets }) =>
          req.payload.update({
            collection: "modules",
            id,
            data: { questionOffsets: offsets },
            depth: 0,
            overrideAccess: true,
            context: { ...context, skipQuestionOffsets: true },
          }),
        ),
      );
    } catch (err) {
      req.payload.logger.error({ err }, "[syncQuestionOffsets] failed");
    } finally {
      processingCourses.delete(courseId);
    }
  })();

  return doc;
};
