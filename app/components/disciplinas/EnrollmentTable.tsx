"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  GripVertical,
  Hash,
  ListChecks,
  Loader2,
  Pencil,
  Percent,
  Search,
  TextCursorInput,
  Trash2,
  User,
  UserMinus,
  X,
} from "lucide-react";
import { UsersThreeIcon } from "@/components/ui/users-three-icon";
import { GradeIcon } from "@/components/ui/grade-icon";
import {
  formatPoints,
  questionsOf,
  type AssessmentQuestion,
  type AssessmentRow,
  type AssessmentTask,
} from "@/lib/assessment";
import {
  completedTasksFor,
  formatGrade,
  formatTotal,
  gradeInputValue,
  gradeTone,
  groupPercentage,
  groupQuestionMark,
  groupTaskState,
  nextGradeCell,
  nextGradeCellAcross,
  parseGradeInput,
  percentageFor,
  questionMarkFor,
  withQuestionMark,
  toggleTask,
  totalFor,
  totalTone,
  type GradeTone,
  type GradeDisplay,
  type ScoreRow,
} from "@/lib/grades";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { comBasePath } from "@/lib/base-path";
import { useCoarsePointer, useMediaQuery } from "@/lib/use-coarse-pointer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filterAndSortEnrollments,
  groupEnrollments,
  groupOfDropId,
  sectionDropId,
  type EnrollmentRow,
  type EnrollmentSortField,
  type StudentGroupOption,
} from "@/lib/enrollment";
import { validateGroupName } from "@/lib/group-draw";
import { AssessmentInfo } from "./AssessmentInfo";
import { EnrollStudentsModal } from "./EnrollStudentsModal";
import { GroupsModal } from "./GroupsModal";
import { SigaaExportModal } from "./SigaaExportModal";

type Direction = "asc" | "desc";

/** What to tell the user when saving grades was refused or failed. */
function saveFailureMessage(status: number, what: string): string {
  if (status === 401) {
    return `Sua sessão expirou. Entre novamente: ${what} não foi salvo.`;
  }
  if (status === 403) {
    return "Sua sessão não permite lançar notas. Entre novamente como administrador.";
  }
  if (status === 409) {
    return "Esta nota foi alterada em outro lugar. A tabela foi recarregada; confira e tente de novo.";
  }
  return `Não foi possível salvar ${what}. Tente novamente.`;
}

// A stable default: a fresh `[]` on every render would retrigger the effects
// that watch the `groups` prop, forever.
const NO_GROUPS: StudentGroupOption[] = [];
const NO_ASSESSMENTS: AssessmentRow[] = [];
const NO_SCORES: ScoreRow[] = [];

/** Blue at or above 60%, red below it; nothing where there is no grade. */
const TONE_CLASS: Record<GradeTone, string> = {
  pass: "text-blue-600 dark:text-blue-400",
  fail: "text-red-600 dark:text-red-400",
};
const toneClass = (tone: GradeTone | null) =>
  tone ? TONE_CLASS[tone] : "text-muted-foreground/40";

/**
 * The students enrolled in the offer on screen: a count, a magnifier that
 * opens into a search box, and a table sortable by matrícula or name. Its header carries the "Cadastrar
 * aluno(s)" button.
 *
 * The "Turma" column — the first one, sortable like the others — only exists
 * when the class is split, i.e. when some student belongs to turma A or B.
 *
 * A two-icon switch beside the count chooses the view: one person lists
 * everybody in alphabetical order (the default); three people breaks the
 * same table into one section per work group, groups and members both in
 * alphabetical order. In that view the "add" button creates groups instead
 * of enrolling students.
 *
 * The "10 ✓" button switches on the grades view: one column per assessment
 * of the offer, to the right of the name, with each student's grade. While
 * it is on, a second two-icon switch chooses between points obtained and
 * percentage of the assessment. A last column adds the points up, bonus
 * included. Grades are blue from 60% up and red below it: each one against
 * its own assessment, the total against the points handed out so far — a
 * partial result that becomes final once everything is graded.
 *
 * A text-cursor button in the grades group turns on grade entry: a cell becomes an
 * input when clicked, in the unit on screen (points or percentage), and Tab
 * walks down the same assessment, student after student. In the "by group"
 * view each group's row gets a cell under every assessment graded per group;
 * a grade typed there is given to each member — as their own, so it stays
 * with them if they change group later.
 *
 * An assessment graded by tasks ("checklist") is not typed: during grade
 * entry it opens into one checkbox column per task, ticked as each student
 * does it, and its grade is the share of tasks done.
 *
 * An assessment graded by questions is not typed either: during grade entry
 * it opens into one column per question, each a percentage typed like any
 * grade (Enter walks down the question), and its grade is the average of those
 * marks weighted by the questions' weights.
 *
 * The pencil beside the magnifier switches on the table's own edit mode
 * (unrelated to the site-wide one in the top bar): each row then gets a bin
 * that removes that student from the offer, after a confirmation that pops
 * up right beside it. In the "by group" view, edit mode is about the groups
 * instead: a student can be dragged from one group to another (or to "Sem
 * grupo"), the row's button takes them out of their group rather than out of
 * the offer, and each group gets a pencil to rename it and a bin to remove
 * it.
 */
export function EnrollmentTable({
  offerId,
  offerPeriod,
  enrollments,
  groups = NO_GROUPS,
  assessments = NO_ASSESSMENTS,
  scores = NO_SCORES,
}: {
  offerId: string | number;
  offerPeriod: string;
  enrollments: EnrollmentRow[];
  /** The offer's work groups, for the "by group" view. */
  groups?: StudentGroupOption[];
  /** The offer's assessments and the grades given, for the grades view. */
  assessments?: AssessmentRow[];
  scores?: ScoreRow[];
}) {
  // Grades view: one column per assessment, to the right of the name.
  const [showGrades, setShowGrades] = useState(false);
  const [gradeDisplay, setGradeDisplay] = useState<GradeDisplay>("percent");
  const gradeColumns = showGrades ? assessments : NO_ASSESSMENTS;
  // Entering grades: a mode of its own inside the grades view, so that
  // looking a grade up never risks changing it.
  const [gradeEntry, setGradeEntry] = useState(false);
  const enteringGrades = showGrades && gradeEntry;
  // The cell being typed into ("s:<assessment>:<student>" or
  // "g:<assessment>:<group>"), and what is wrong with what was typed.
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [cellError, setCellError] = useState<string | null>(null);
  // Grades typed here, by "<assessment>:<student>" — ahead of the `scores`
  // prop until the server re-render lands. Null is a cleared grade.
  const [scoreOverrides, setScoreOverrides] = useState<
    Record<string, number | null>
  >({});
  useEffect(() => setScoreOverrides({}), [scores]);

  // Tasks ticked here, by "<assessment>:<student>" — the same idea, for
  // checklist assessments: the ids of the tasks the student has done.
  const [taskOverrides, setTaskOverrides] = useState<Record<string, string[]>>(
    {},
  );
  useEffect(() => setTaskOverrides({}), [scores]);

  // Question marks typed here, by "<assessment>:<student>": that student's
  // whole set of marks in the assessment, by question id.
  const [markOverrides, setMarkOverrides] = useState<
    Record<string, Record<string, number>>
  >({});
  useEffect(() => setMarkOverrides({}), [scores]);

  const currentScores = useMemo(() => {
    const keyOf = (score: ScoreRow) =>
      `${score.assessmentId}:${score.enrollmentId}`;
    let list = scores;

    const typedKeys = Object.keys(scoreOverrides);
    if (typedKeys.length > 0) {
      const typed = typedKeys.flatMap((key) => {
        const percentage = scoreOverrides[key];
        if (percentage === null) return [];
        const [assessmentId, enrollmentId] = key.split(":");
        return [{ id: `local:${key}`, assessmentId, enrollmentId, percentage }];
      });
      list = [...list.filter((s) => !(keyOf(s) in scoreOverrides)), ...typed];
    }

    const tickedKeys = Object.keys(taskOverrides);
    if (tickedKeys.length > 0) {
      const ticked = tickedKeys.map((key) => {
        const [assessmentId, enrollmentId] = key.split(":");
        const saved = list.find((s) => keyOf(s) === key);
        return {
          id: saved?.id ?? `local:${key}`,
          assessmentId,
          enrollmentId,
          percentage: saved?.percentage ?? 0,
          completedTaskIds: taskOverrides[key],
        };
      });
      list = [...list.filter((s) => !(keyOf(s) in taskOverrides)), ...ticked];
    }
    const markedKeys = Object.keys(markOverrides);
    if (markedKeys.length > 0) {
      const marked = markedKeys.map((key) => {
        const [assessmentId, enrollmentId] = key.split(":");
        const saved = list.find((s) => keyOf(s) === key);
        return {
          id: saved?.id ?? `local:${key}`,
          assessmentId,
          enrollmentId,
          percentage: saved?.percentage ?? 0,
          questionPercentages: markOverrides[key],
        };
      });
      list = [...list.filter((s) => !(keyOf(s) in markOverrides)), ...marked];
    }
    return list;
  }, [scores, scoreOverrides, taskOverrides, markOverrides]);

  const coarse = useCoarsePointer();
  // Touch screens have no hover: a tap on a heading opens what the hover
  // balloon says, and a legend lists every assessment at once.
  const [infoOpen, setInfoOpen] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  useEffect(() => {
    if (infoOpen === null) return;
    const close = () => setInfoOpen(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [infoOpen]);
  /** A heading's text as a tap target that opens `content` below it. */
  const tapInfo = (
    key: string,
    label: string,
    align: string,
    shown: ReactNode,
    content: ReactNode,
  ) => (
    <Popover
      open={infoOpen === key}
      onOpenChange={(open) => setInfoOpen(open ? key : null)}
    >
      <PopoverTrigger
        aria-label={label}
        data-tooltip="off"
        className={`block w-full rounded font-[inherit] ${align} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
      >
        {shown}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        collisionPadding={8}
        className="w-72 max-w-[calc(100vw-1rem)] p-3"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
  // Requests to save grades in flight, for the "Salvando…" note.
  const [saving, setSaving] = useState(0);
  // A group-wide grade waiting for a yes, because it would replace
  // different grades its members already have.
  const [confirmWrite, setConfirmWrite] = useState<{
    message: string;
    run: () => void;
  } | null>(null);
  // The `updatedAt` each score row had when last saved from here, by
  // "<assessment>:<student>": ahead of the `scores` prop until the server
  // re-render lands, so that two quick changes are not taken for a clash.
  const stampsRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    stampsRef.current = {};
  }, [scores]);

  /** What the server should find: the stamps this table last saw. */
  const expectedFor = (assessment: AssessmentRow, rows: EnrollmentRow[]) =>
    Object.fromEntries(
      rows.map((row) => {
        const key = `${assessment.id}:${row.id}`;
        const saved =
          key in stampsRef.current
            ? stampsRef.current[key]
            : (scores.find(
                (s) =>
                  String(s.assessmentId) === String(assessment.id) &&
                  String(s.enrollmentId) === String(row.id),
              )?.updatedAt ?? null);
        return [String(row.id), saved];
      }),
    );

  /**
   * Sends a change of grades. Calls `undo` with a message when it cannot be
   * saved — no connection, a session gone, someone else's change in between.
   * `what` names the change in those messages ("a nota de P1").
   */
  async function sendScores(
    path: string,
    assessment: AssessmentRow,
    rows: EnrollmentRow[],
    body: Record<string, unknown>,
    what: string,
    undo: (message: string) => void,
  ) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      undo(`Sem conexão: ${what} não foi salvo.`);
      return;
    }
    setSaving((n) => n + 1);
    try {
      const res = await fetch(comBasePath(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offer: offerId,
          activity: assessment.id,
          enrollments: rows.map((row) => row.id),
          expected: expectedFor(assessment, rows),
          ...body,
        }),
      });
      if (!res.ok) {
        undo(saveFailureMessage(res.status, what));
        // Someone else changed it: show what is there now.
        if (res.status === 409) router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        stamps?: Record<string, string | null>;
      } | null;
      for (const [id, stamp] of Object.entries(data?.stamps ?? {})) {
        stampsRef.current[`${assessment.id}:${id}`] = stamp;
      }
      router.refresh();
    } catch {
      undo(`Erro de conexão: ${what} não foi salvo. Tente novamente.`);
    } finally {
      setSaving((n) => n - 1);
    }
  }
  // One list in alphabetical order, or the same students under their groups.
  const [view, setView] = useState<"students" | "groups">("students");
  const [search, setSearch] = useState("");
  // The search box stays folded into a magnifier until asked for, and folds
  // back when left empty.
  const [searchOpen, setSearchOpen] = useState(false);

  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // The student whose removal is awaiting confirmation.
  const [removing, setRemoving] = useState<EnrollmentRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Removed here, still in `enrollments` until the server re-render lands.
  const [removedIds, setRemovedIds] = useState<(string | number)[]>([]);

  // Students moved to another group here, by row id — ahead of the
  // `enrollments` prop until the server re-render lands.
  const [movedGroups, setMovedGroups] = useState<
    Record<string, string | number | null>
  >({});
  useEffect(() => setMovedGroups({}), [enrollments]);
  const [moveError, setMoveError] = useState<string | null>(null);
  // The student being dragged, for the floating label that follows the mouse.
  const [dragged, setDragged] = useState<EnrollmentRow | null>(null);

  const current = useMemo(
    () =>
      enrollments
        .filter((row) => !removedIds.includes(row.id))
        .map((row) =>
          String(row.id) in movedGroups
            ? { ...row, groupId: movedGroups[String(row.id)] }
            : row,
        ),
    [enrollments, removedIds, movedGroups],
  );

  // The group whose removal is awaiting confirmation, and the ones removed
  // here that `groups` still lists until the server re-render lands.
  const [removingGroupId, setRemovingGroupId] = useState<
    string | number | null
  >(null);
  const [removedGroupIds, setRemovedGroupIds] = useState<(string | number)[]>(
    [],
  );
  // Groups renamed here, by id — same idea as `movedGroups`.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  useEffect(() => setRenamed({}), [groups]);
  // The group whose name is being typed over, and the text so far.
  const [renaming, setRenaming] = useState<{
    id: string | number;
    text: string;
  } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  const currentGroups = useMemo(
    () =>
      groups
        .filter((group) => !removedGroupIds.includes(group.id))
        .map((group) =>
          String(group.id) in renamed
            ? { ...group, name: renamed[String(group.id)] }
            : group,
        ),
    [groups, removedGroupIds, renamed],
  );

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!renaming || busy) return;
    const group = currentGroups.find((g) => g.id === renaming.id);
    if (!group) return;

    const checked = validateGroupName(
      renaming.text,
      currentGroups.filter((g) => g.id !== group.id).map((g) => g.name),
    );
    if (!checked.ok) {
      setRenameError(checked.error);
      return;
    }
    if (checked.name === group.name) {
      setRenaming(null);
      return;
    }

    setBusy(true);
    setRenameError(null);
    try {
      const res = await fetch(
        comBasePath(`/api/student-groups/${group.id}?depth=0`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: checked.name }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const paths: unknown[] =
          data?.errors?.[0]?.data?.errors?.map(
            (e: { path?: unknown }) => e.path,
          ) ?? [];
        setRenameError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite renomear grupos. Entre novamente como administrador."
            : paths.includes("name")
              ? `Já existe um grupo chamado “${checked.name}”.`
              : "Não foi possível renomear o grupo. Tente novamente.",
        );
        return;
      }
      setRenamed((names) => ({ ...names, [String(group.id)]: checked.name }));
      setRenaming(null);
      router.refresh();
    } catch {
      setRenameError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  /** Puts a student in another group — or in none, with `null`. */
  async function moveStudent(
    row: EnrollmentRow,
    targetGroupId: string | number | null,
  ) {
    const from = row.groupId ?? null;
    if (String(from) === String(targetGroupId)) return;

    // Shown at once; taken back if the server refuses.
    setMoveError(null);
    setMovedGroups((moved) => ({ ...moved, [String(row.id)]: targetGroupId }));
    const undo = () =>
      setMovedGroups((moved) => ({ ...moved, [String(row.id)]: from }));
    try {
      const res = await fetch(
        comBasePath(`/api/enrollments/${row.id}?depth=0`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ group: targetGroupId }),
        },
      );
      if (!res.ok) {
        undo();
        setMoveError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite mover discentes. Entre novamente como administrador."
            : `Não foi possível mover ${row.name}. Tente novamente.`,
        );
        return;
      }
      router.refresh();
    } catch {
      undo();
      setMoveError("Erro de conexão ao mover o discente. Tente novamente.");
    }
  }

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a plain click on the
    // row's bin is still a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A finger drags only after a press-and-hold, so that scrolling the
    // table with it stays scrolling.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    setDragged(
      current.find((row) => `row:${row.id}` === event.active.id) ?? null,
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const row = dragged;
    setDragged(null);
    const target = groupOfDropId(event.over?.id);
    if (!row || target === undefined) return;
    const group =
      target === null
        ? null
        : (currentGroups.find((g) => String(g.id) === target)?.id ?? null);
    if (target !== null && group === null) return;
    void moveStudent(row, group);
  }

  async function removeGroup(group: StudentGroupOption) {
    if (busy) return;
    setBusy(true);
    setRemoveError(null);
    try {
      const res = await fetch(comBasePath(`/api/student-groups/${group.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 404) {
        setRemoveError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite remover grupos. Entre novamente como administrador."
            : "Não foi possível remover o grupo. Tente novamente.",
        );
        return;
      }
      setRemovedGroupIds((ids) => [...ids, group.id]);
      setRemovingGroupId(null);
      router.refresh();
    } catch {
      setRemoveError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function askToRemove(row: EnrollmentRow) {
    setRemoveError(null);
    setRemoving(row);
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setRemoveError(null);
    try {
      const res = await fetch(comBasePath(`/api/enrollments/${removing.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      // 404: already gone (another tab) — the outcome asked for.
      if (!res.ok && res.status !== 404) {
        setRemoveError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite remover discentes. Entre novamente como administrador."
            : "Não foi possível remover o discente. Tente novamente.",
        );
        return;
      }
      setRemovedIds((ids) => [...ids, removing.id]);
      setRemoving(null);
      router.refresh();
    } catch {
      setRemoveError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  const [field, setField] = useState<EnrollmentSortField>("name");
  const [direction, setDirection] = useState<Direction>("asc");

  // Clicking the active column flips the direction; a new column starts A→Z.
  function sortBy(next: EnrollmentSortField) {
    if (next === field) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setField(next);
      setDirection("asc");
    }
  }

  const visible = useMemo(
    () => filterAndSortEnrollments(current, search, field, direction),
    [current, search, field, direction],
  );
  // Dragging between groups is on: "by group" view, in edit mode.
  // Not while grades are being typed: a click on a cell must stay a click.
  const canDrag = view === "groups" && editing && !enteringGrades;

  const sections = useMemo(() => {
    const searching = search.trim() !== "";
    // While searching, a group with no match would only be noise.
    const list = groupEnrollments(visible, currentGroups).filter(
      (section) => !searching || section.rows.length > 0,
    );
    // While dragging is on there is always somewhere to drop a student to
    // take them out of their group.
    return canDrag && !searching && !list.some((s) => s.group === null)
      ? [...list, { group: null, rows: [] }]
      : list;
  }, [visible, currentGroups, search, canDrag]);
  const split = current.some((row) => row.classGroup);
  // Turma and matrícula take room the grades need: they give way on a
  // narrow screen, and while grades are being entered (the name stays).
  const wide = useMediaQuery("(min-width: 768px)", true);
  const showIdentity = wide && !enteringGrades;
  const identityCols = showIdentity ? (split ? 2 : 1) : 0;
  // While grades are being entered, a checklist assessment opens up into
  // one checkbox column per task, to the left of its grade.
  const taskColumns = (assessment: AssessmentRow): AssessmentTask[] =>
    enteringGrades && assessment.mode === "checklist" ? assessment.tasks : [];
  // A questions assessment likewise opens into one column per question.
  const questionColumns = (assessment: AssessmentRow): AssessmentQuestion[] =>
    enteringGrades && assessment.mode === "questions"
      ? questionsOf(assessment)
      : [];
  const subColumnCount = (assessment: AssessmentRow) =>
    taskColumns(assessment).length + questionColumns(assessment).length;
  // Checkbox columns need a second heading row: the assessment's name spans
  // them all, and the task labels sit beneath it.
  const headRows = gradeColumns.some((a) => subColumnCount(a) > 0) ? 2 : 1;
  const columns =
    identityCols +
    1 +
    // One column per assessment (plus its tasks' checkboxes), and the total.
    (showGrades
      ? gradeColumns.reduce((n, a) => n + 1 + subColumnCount(a), 0) + 1
      : 0) +
    (editing ? 1 : 0);

  /**
   * Marks a task of a checklist assessment done, or not, for the students
   * given — one, or every member of a group. Shown at once; taken back if
   * the server refuses.
   */
  function setTaskDone(
    assessment: AssessmentRow,
    task: AssessmentTask,
    students: EnrollmentRow[],
    done: boolean,
  ) {
    const changed = students.filter(
      (row) =>
        completedTasksFor(row, assessment, currentScores).has(task.id) !== done,
    );
    if (changed.length === 0) return;

    const before = Object.fromEntries(
      changed.map((row) => [
        `${assessment.id}:${row.id}`,
        [...completedTasksFor(row, assessment, currentScores)],
      ]),
    );
    setMoveError(null);
    setTaskOverrides((ticked) => ({
      ...ticked,
      ...Object.fromEntries(
        Object.entries(before).map(([key, ids]) => [
          key,
          toggleTask(ids, task.id, done),
        ]),
      ),
    }));

    void sendScores(
      "/api/scores/tasks",
      assessment,
      changed,
      { task: task.id, done },
      `“${task.name}” em ${assessment.code}`,
      (message) => {
        setTaskOverrides((ticked) => ({ ...ticked, ...before }));
        setMoveError(message);
      },
    );
  }

  /**
   * Gives a mark (0–100%) in one question of a "questions" assessment to the
   * students of a cell — one, or every member of a group. Shown at once;
   * taken back if the server refuses. Returns false — leaving the cell open
   * — only when the text is not a valid mark.
   */
  function commitQuestionMark(cellId: string, text: string): boolean {
    const [kind, assessmentId, questionId, targetId] = cellId.split(":");
    const assessment = assessments.find((a) => String(a.id) === assessmentId);
    const question = (assessment ? questionsOf(assessment) : []).find(
      (q) => q.id === questionId,
    );
    if (!assessment || !question) return true;

    const parsed = parseGradeInput(text, 100, "percent");
    if (!parsed.ok) {
      setCellError(parsed.error);
      return false;
    }
    setCellError(null);

    const students =
      kind === "qg"
        ? current.filter((row) => String(row.groupId) === targetId)
        : current.filter((row) => String(row.id) === targetId);
    const changed = students.filter((row) => {
      const before = questionMarkFor(
        row,
        assessment,
        question.id,
        currentScores,
      );
      return before === null || parsed.percentage === null
        ? before !== parsed.percentage
        : Math.abs(before - parsed.percentage) > 1e-6;
    });
    if (changed.length === 0) return true;

    const apply = () => {
      const validIds = questionsOf(assessment).map((q) => q.id);
      const marksOf = (row: EnrollmentRow) => {
        const score = currentScores.find(
          (s) =>
            String(s.assessmentId) === String(assessment.id) &&
            String(s.enrollmentId) === String(row.id),
        );
        return score?.questionPercentages ?? {};
      };
      const before = Object.fromEntries(
        changed.map((row) => [`${assessment.id}:${row.id}`, marksOf(row)]),
      );
      setMoveError(null);
      setMarkOverrides((marked) => ({
        ...marked,
        ...Object.fromEntries(
          changed.map((row) => [
            `${assessment.id}:${row.id}`,
            withQuestionMark(
              marksOf(row),
              question.id,
              parsed.percentage,
              validIds,
            ),
          ]),
        ),
      }));

      void sendScores(
        "/api/scores/questions",
        assessment,
        changed,
        { question: question.id, percentage: parsed.percentage },
        `“${question.name}” em ${assessment.code}`,
        (message) => {
          setMarkOverrides((marked) => ({ ...marked, ...before }));
          setMoveError(message);
        },
      );
    };
    if (
      kind === "qg" &&
      groupQuestionMark(students, assessment, question.id, currentScores)
        .kind === "mixed"
    ) {
      setConfirmWrite({
        message: `Os integrantes do grupo têm notas diferentes em “${question.name}”, de ${assessment.code}. Dar esta nota ao grupo substitui as notas individuais.`,
        run: apply,
      });
      return true;
    }
    apply();
    return true;
  }

  // The rows as on screen, top to bottom: where Tab goes across, and Enter
  // down. A group's own row comes right above its members'.
  const gradeRowOrder = useMemo(
    () =>
      view === "groups"
        ? sections.flatMap((section) => [
            ...(section.group ? [`g:${section.group.id}`] : []),
            ...section.rows.map((row) => `s:${row.id}`),
          ])
        : visible.map((row) => `s:${row.id}`),
    [view, sections, visible],
  );

  // Editable cells, per column left to right, each top to bottom as on
  // screen. A group's own cell comes right above its members'.
  const gradeCellOrder = useMemo(
    () =>
      gradeColumns.flatMap((assessment) => {
        if (assessment.mode === "checklist") {
          // One column of checkboxes per task. A group's own checkbox only
          // exists when the group has members.
          return assessment.tasks.map((task) =>
            view === "groups"
              ? sections.flatMap((section) => [
                  ...(section.group &&
                  assessment.scoredBy === "group" &&
                  current.some(
                    (row) => String(row.groupId) === String(section.group!.id),
                  )
                    ? [`tg:${assessment.id}:${task.id}:${section.group.id}`]
                    : []),
                  ...section.rows.map(
                    (row) => `t:${assessment.id}:${task.id}:${row.id}`,
                  ),
                ])
              : visible.map((row) => `t:${assessment.id}:${task.id}:${row.id}`),
          );
        }
        if (assessment.mode === "questions") {
          // One column per question, only while grades are being entered.
          return questionsOf(assessment).map((question) =>
            view === "groups"
              ? sections.flatMap((section) => [
                  ...(section.group && assessment.scoredBy === "group"
                    ? [`qg:${assessment.id}:${question.id}:${section.group.id}`]
                    : []),
                  ...section.rows.map(
                    (row) => `q:${assessment.id}:${question.id}:${row.id}`,
                  ),
                ])
              : visible.map(
                  (row) => `q:${assessment.id}:${question.id}:${row.id}`,
                ),
          );
        }
        return [
          view === "groups"
            ? sections.flatMap((section) => [
                ...(section.group && assessment.scoredBy === "group"
                  ? [`g:${assessment.id}:${section.group.id}`]
                  : []),
                ...section.rows.map((row) => `s:${assessment.id}:${row.id}`),
              ])
            : visible.map((row) => `s:${assessment.id}:${row.id}`),
        ];
      }),
    [gradeColumns, view, sections, visible, current],
  );

  /**
   * Goes to the cell next to `id`, from a checkbox or a number: a number
   * opens as an input, a checkbox takes the keyboard focus. Does nothing
   * where there is no cell that way.
   */
  function goToCell(id: string, direction: 1 | -1, axis: "across" | "down") {
    const next = neighbourCell(id, direction, axis);
    if (next === null) return;
    setCellError(null);
    if (isCheckboxCell(next)) {
      setOpenCell(null);
      // After the input that may be open has closed.
      setTimeout(
        () =>
          document
            .querySelector<HTMLInputElement>(`[data-grade-cell="${next}"]`)
            ?.focus(),
        0,
      );
    } else {
      setOpenCell(next);
    }
  }

  /**
   * Saves what was typed into a cell. Returns false — leaving the cell open
   * — only when the text is not a valid grade; a request that fails later
   * takes the grade back and says so above the table.
   */
  function commitGrade(cellId: string, text: string): boolean {
    const [kind, assessmentId, targetId] = cellId.split(":");
    const assessment = assessments.find((a) => String(a.id) === assessmentId);
    if (!assessment) return true;

    const parsed = parseGradeInput(text, assessment.weight, gradeDisplay);
    if (!parsed.ok) {
      setCellError(parsed.error);
      return false;
    }
    setCellError(null);

    // A group's cell stands for all of its members, searched for or not.
    const students =
      kind === "g"
        ? current.filter((row) => String(row.groupId) === targetId)
        : current.filter((row) => String(row.id) === targetId);
    const changed = students.filter((row) => {
      const before = percentageFor(row, assessment, currentScores);
      return before === null || parsed.percentage === null
        ? before !== parsed.percentage
        : Math.abs(before - parsed.percentage) > 1e-6;
    });
    if (changed.length === 0) return true;

    const apply = () => {
      const keys = changed.map((row) => `${assessment.id}:${row.id}`);
      const before = Object.fromEntries(
        changed.map((row) => [
          `${assessment.id}:${row.id}`,
          percentageFor(row, assessment, currentScores),
        ]),
      );
      setMoveError(null);
      setScoreOverrides((typed) => ({
        ...typed,
        ...Object.fromEntries(keys.map((key) => [key, parsed.percentage])),
      }));

      void sendScores(
        "/api/scores/set",
        assessment,
        changed,
        { percentage: parsed.percentage },
        `a nota de ${assessment.code}`,
        (message) => {
          setScoreOverrides((typed) => ({ ...typed, ...before }));
          setMoveError(message);
        },
      );
    };
    if (
      kind === "g" &&
      groupPercentage(students, assessment, currentScores).kind === "mixed"
    ) {
      setConfirmWrite({
        message: `Os integrantes do grupo têm notas diferentes em ${assessment.code}. Dar esta nota ao grupo substitui as notas individuais.`,
        run: apply,
      });
      return true;
    }
    apply();
    return true;
  }

  /** The cell next to another: across its row (Tab) or down its column. */
  const neighbourCell = (
    id: string,
    direction: 1 | -1,
    axis: "across" | "down",
  ) =>
    axis === "down"
      ? nextGradeCell(gradeCellOrder, id, direction)
      : nextGradeCellAcross(gradeCellOrder, gradeRowOrder, id, direction);

  /** What goes inside a grade cell: plain text, a button, or the input. */
  const gradeCell = ({
    id,
    assessment,
    text,
    initial,
    label,
    percentOnly = false,
  }: {
    id: string;
    assessment: AssessmentRow;
    text: string;
    initial: string;
    label: string;
    /** A question's cell: always typed as a percentage, 0–100. */
    percentOnly?: boolean;
  }) => {
    // A checklist's or a questions assessment's grade is worked out from its
    // tasks or questions, never typed; only the questions' own cells are.
    if (!enteringGrades || (assessment.mode !== "graded" && !percentOnly)) {
      return text;
    }
    const asPercent = percentOnly || gradeDisplay === "percent";
    // "P1", or "P1 · Q2" for one question of a questions assessment.
    const question = percentOnly
      ? questionsOf(assessment).find((q) => q.id === id.split(":")[2])
      : undefined;
    const tag = question
      ? `${assessment.code} · ${question.code || question.name}`
      : assessment.code;
    if (openCell !== id) {
      return (
        <button
          type="button"
          onClick={() => {
            setCellError(null);
            setOpenCell(id);
          }}
          aria-label={label}
          data-grade-cell={id}
          className="w-full rounded px-2 py-1.5 text-right transition-colors [@media(pointer:coarse)]:py-3 hover:bg-primary/10 hover:outline hover:outline-1 hover:outline-primary/40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
        >
          {text}
        </button>
      );
    }
    return (
      <GradeInput
        key={id}
        label={label}
        tag={tag}
        initial={initial}
        suffix={asPercent ? "%" : undefined}
        max={asPercent ? "100" : formatPoints(assessment.weight)}
        error={cellError}
        onCommit={(value) =>
          percentOnly ? commitQuestionMark(id, value) : commitGrade(id, value)
        }
        onClose={() => {
          setCellError(null);
          setOpenCell(null);
        }}
        hasNext={(direction, axis) =>
          neighbourCell(id, direction, axis) !== null
        }
        onMove={(direction, axis) => goToCell(id, direction, axis)}
      />
    );
  };

  const sortButton = (
    target: EnrollmentSortField,
    label: string,
    shown: string = label,
  ) => {
    const active = field === target;
    const Icon = !active
      ? ArrowUpDown
      : direction === "asc"
        ? ArrowUp
        : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => sortBy(target)}
        aria-label={`Ordenar por ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {shown}
        <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} />
      </button>
    );
  };

  const renderRow = (row: EnrollmentRow, drag?: DragWiring) => {
    // The grip sits in the row's first cell, whichever column that is.
    const handle = drag && (
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        {...drag.attributes}
        aria-label={`Mover ${row.name}`}
        className="-ml-2 inline-flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    );
    return (
      <tr
        key={row.id}
        ref={drag?.setNodeRef}
        {...drag?.listeners}
        className={`transition-colors hover:bg-muted/40 ${
          drag ? "cursor-grab select-none" : ""
        } ${drag?.isDragging ? "opacity-30" : ""}`}
      >
        {showIdentity && split && (
          <td className="px-3 py-2.5 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {handle}
              {row.classGroup ?? "—"}
            </span>
          </td>
        )}
        {showIdentity && (
          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
            {split ? (
              row.registration
            ) : (
              <span className="flex items-center gap-1.5">
                {handle}
                {row.registration}
              </span>
            )}
          </td>
        )}
        <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium">
          {row.name}
        </td>
        {gradeColumns.map((assessment) => {
          const percentage = percentageFor(row, assessment, currentScores);
          const tone = gradeTone(percentage);
          const done = completedTasksFor(row, assessment, currentScores);
          return (
            <Fragment key={assessment.id}>
              {questionColumns(assessment).map((question) => {
                const mark = questionMarkFor(
                  row,
                  assessment,
                  question.id,
                  currentScores,
                );
                return (
                  <td
                    key={question.id}
                    className="px-1 py-1 text-right font-mono text-xs tabular-nums"
                  >
                    {gradeCell({
                      id: `q:${assessment.id}:${question.id}:${row.id}`,
                      assessment,
                      percentOnly: true,
                      text: formatGrade(mark, assessment.weight, "percent"),
                      initial: gradeInputValue(
                        mark,
                        assessment.weight,
                        "percent",
                      ),
                      label: `Nota de ${row.name} em ${question.name}, de ${assessment.code}`,
                    })}
                  </td>
                );
              })}
              {taskColumns(assessment).map((task) => (
                <td key={task.id} className="px-0.5 py-1 text-center">
                  <TaskCheckbox
                    cellId={`t:${assessment.id}:${task.id}:${row.id}`}
                    onNavigate={goToCell}
                    label={`${row.name} fez ${task.name}, de ${assessment.code}`}
                    state={done.has(task.id) ? "all" : "none"}
                    onChange={(checked) =>
                      setTaskDone(assessment, task, [row], checked)
                    }
                  />
                </td>
              ))}
              <td
                data-tone={tone ?? undefined}
                className={`text-right font-mono text-xs tabular-nums ${
                  enteringGrades && assessment.mode === "graded"
                    ? "px-1 py-1"
                    : "px-3 py-2.5"
                } ${toneClass(tone)}`}
              >
                {gradeCell({
                  id: `s:${assessment.id}:${row.id}`,
                  assessment,
                  text: formatGrade(
                    percentage,
                    assessment.weight,
                    gradeDisplay,
                  ),
                  initial: gradeInputValue(
                    percentage,
                    assessment.weight,
                    gradeDisplay,
                  ),
                  label: `Nota de ${row.name} em ${assessment.code}`,
                })}
              </td>
            </Fragment>
          );
        })}
        {showGrades &&
          (() => {
            const total = totalFor(row, assessments, currentScores);
            const tone = totalTone(total);
            return (
              <td
                data-tone={tone ?? undefined}
                className={`border-l border-border/40 px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums ${
                  // Bonus points alone: a real number, with nothing to
                  // judge it against yet.
                  total.graded && tone === null
                    ? "text-foreground"
                    : toneClass(tone)
                }`}
              >
                {formatTotal(total, gradeDisplay)}
              </td>
            );
          })()}
        {editing && view === "groups" && (
          <td className="px-4 py-1 text-right">
            {/* In this view the row's action is about the group, not the
              offer: it sends the student straight to "Sem grupo". Nothing
              to offer to a student who is in no group already. */}
            {currentGroups.some(
              (g) => String(g.id) === String(row.groupId),
            ) && (
              <button
                type="button"
                onClick={() => void moveStudent(row, null)}
                aria-label={`Remover ${row.name} do grupo`}
                className="inline-flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 dark:text-red-400/60 dark:hover:text-red-400"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            )}
          </td>
        )}
        {editing && view === "students" && (
          <td className="px-4 py-1 text-right">
            <Popover
              open={removing?.id === row.id}
              onOpenChange={(open) => {
                if (open) askToRemove(row);
                else if (!busy) setRemoving(null);
              }}
            >
              <PopoverTrigger
                aria-label={`Remover ${row.name}`}
                className="inline-flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 data-[state=open]:bg-red-500/10 data-[state=open]:text-red-600 dark:text-red-400/60 dark:hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </PopoverTrigger>
              {/* Beside the bin, with no backdrop: confirming is one
                short move of the pointer away. */}
              <PopoverContent
                side="left"
                align="center"
                sideOffset={8}
                aria-label="Remover discente?"
                className="w-72 space-y-3 p-3 text-left duration-75"
              >
                <p className="text-sm font-semibold text-foreground">
                  Remover discente?
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">{row.name}</strong>{" "}
                  (matrícula{" "}
                  <span className="font-mono">{row.registration}</span>) sairá
                  da oferta {offerPeriod}. Não dá para desfazer.
                </p>
                {removeError && (
                  <p
                    role="alert"
                    className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
                  >
                    {removeError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRemoving(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={remove}
                  >
                    {busy && <Loader2 className="animate-spin" />}
                    Remover
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </td>
        )}
      </tr>
    );
  };

  return (
    <section
      aria-label="Discentes da oferta"
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Discentes
        </h2>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {visible.length === current.length
            ? current.length
            : `${visible.length} de ${current.length}`}
        </span>
        <span aria-hidden="true" className="h-5 w-px bg-border/70" />
        <div
          role="group"
          aria-label="Modo de visualização"
          className="flex items-center rounded-md border border-border/60 p-0.5"
        >
          <button
            type="button"
            onClick={() => setView("students")}
            aria-pressed={view === "students"}
            aria-label="Ver por alunos"
            className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              view === "students"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("groups")}
            aria-pressed={view === "groups"}
            aria-label="Ver por grupos"
            className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              view === "groups"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UsersThreeIcon className="h-4 w-4" />
          </button>
        </div>
        <span aria-hidden="true" className="h-5 w-px bg-border/70" />
        {/* The grades group: the switch that shows them and, while they
            are on, the format they are shown in. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpenCell(null);
              setGradeEntry(false);
              setShowGrades((on) => !on);
            }}
            aria-pressed={showGrades}
            aria-label={showGrades ? "Ocultar notas" : "Ver notas"}
            className={`flex h-8 w-8 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              showGrades
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <GradeIcon className="h-4 w-4" />
          </button>
          {showGrades && (
            <div
              role="group"
              aria-label="Formato das notas"
              className="flex items-center rounded-md border border-border/60 p-0.5"
            >
              <button
                type="button"
                onClick={() => setGradeDisplay("points")}
                aria-pressed={gradeDisplay === "points"}
                aria-label="Ver notas em pontos"
                className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  gradeDisplay === "points"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setGradeDisplay("percent")}
                aria-pressed={gradeDisplay === "percent"}
                aria-label="Ver notas em porcentagem"
                className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  gradeDisplay === "percent"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Percent className="h-4 w-4" />
              </button>
            </div>
          )}
          {showGrades && coarse && assessments.length > 0 && (
            <button
              type="button"
              onClick={() => setLegendOpen(true)}
              aria-label="Legenda das avaliações"
              className="flex h-8 w-8 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ListChecks className="h-4 w-4" />
            </button>
          )}
          {showGrades && (
            <button
              type="button"
              onClick={() => {
                setOpenCell(null);
                setCellError(null);
                setGradeEntry((on) => !on);
              }}
              aria-pressed={gradeEntry}
              aria-label={gradeEntry ? "Parar de lançar notas" : "Lançar notas"}
              className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                gradeEntry
                  ? "bg-primary text-primary-foreground hover:bg-primary/85"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <TextCursorInput className="h-4 w-4" />
            </button>
          )}
          {showGrades && (
            <SigaaExportModal
              offerPeriod={offerPeriod}
              enrollments={current}
              assessments={assessments}
              scores={currentScores}
            />
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {searchOpen ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => {
                  if (search.trim() === "") setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setSearchOpen(false);
                  }
                }}
                placeholder="Buscar por nome ou matrícula…"
                aria-label="Buscar discente"
                className="w-64 max-w-full rounded-md border border-border bg-input py-1.5 pl-8 pr-3 text-sm text-foreground transition-colors duration-200 animate-in fade-in-0 slide-in-from-right-2 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar discente"
              className="flex h-8 w-8 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing((on) => !on)}
            aria-pressed={editing}
            aria-label={
              editing
                ? "Sair da edição da tabela"
                : "Editar tabela de discentes"
            }
            title={
              editing
                ? "Sair da edição da tabela"
                : "Editar tabela de discentes"
            }
            className={`flex h-8 w-8 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              editing
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          {view === "groups" ? (
            <GroupsModal
              offerId={offerId}
              offerPeriod={offerPeriod}
              enrollments={current}
              groups={currentGroups}
            />
          ) : (
            <EnrollStudentsModal
              offerId={offerId}
              offerPeriod={offerPeriod}
              enrolledRegistrations={current.map((row) => row.registration)}
            />
          )}
        </div>
      </div>

      <Dialog open={legendOpen} onOpenChange={setLegendOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>Avaliações</DialogTitle>
          <DialogDescription>
            O que cada coluna da tabela de notas abrevia.
          </DialogDescription>
          <ul className="w-full divide-y divide-border/50">
            {assessments.map((assessment) => (
              <li key={assessment.id} className="py-3 first:pt-0 last:pb-0">
                <AssessmentInfo assessment={assessment} compact />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmWrite !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmWrite(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Substituir as notas do grupo?</DialogTitle>
          <DialogDescription>{confirmWrite?.message}</DialogDescription>
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmWrite(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const run = confirmWrite?.run;
                setConfirmWrite(null);
                run?.();
              }}
            >
              Substituir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Notes that come and go while grades are saved float over the
          table instead of pushing it down: the rows must not jump under
          the pointer each time a grade is given. */}
      {saving > 0 && (
        <p
          role="status"
          className="pointer-events-none absolute right-3 top-14 z-40 flex items-center gap-2 rounded-md border border-border/60 bg-popover px-2.5 py-1 text-xs text-muted-foreground shadow-md"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Salvando…
        </p>
      )}
      {/* On a touch screen the cell's own balloon can fall off the edge of
          the scrolling table, so the error is also said here. */}
      {coarse && cellError && !moveError && (
        <p
          role="alert"
          className="absolute inset-x-0 top-14 z-40 border-y border-red-500/20 bg-popover px-4 py-2 text-xs text-red-900 shadow-md dark:text-red-200"
        >
          {cellError}
        </p>
      )}
      {moveError && (
        <p
          role="alert"
          className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-900 dark:text-red-200"
        >
          {moveError}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragged(null)}
      >
        {/* The table scrolls inside its own box, so that its heading can
            stay in view (sticky) while the rows go by: with the grades
            beside it, the heading is what says which assessment is which. */}
        <div className="max-h-[75dvh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-card shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]">
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                {showIdentity && split && (
                  <th
                    scope="col"
                    rowSpan={headRows}
                    data-tooltip="Turma"
                    className="w-14 px-3 py-3 font-semibold"
                    aria-sort={
                      field === "classGroup"
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {sortButton("classGroup", "Turma", "T.")}
                  </th>
                )}
                {showIdentity && (
                  <th
                    scope="col"
                    rowSpan={headRows}
                    data-tooltip="Matrícula"
                    className="w-28 px-3 py-3 font-semibold"
                    aria-sort={
                      field === "registration"
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {sortButton("registration", "Matrícula", "M.")}
                  </th>
                )}
                <th
                  scope="col"
                  rowSpan={headRows}
                  className="sticky left-0 z-10 bg-card px-4 py-3 font-semibold"
                  aria-sort={
                    field === "name"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {sortButton("name", "Nome")}
                </th>
                {gradeColumns.map((assessment) => {
                  const subCount = subColumnCount(assessment);
                  const description = `${assessment.name} — vale ${formatPoints(assessment.weight)}${
                    assessment.scoredBy === "group" ? ", por grupo" : ""
                  }${
                    assessment.mode === "checklist"
                      ? `, ${assessment.tasks.length} tarefa(s)`
                      : assessment.mode === "questions"
                        ? `, ${questionsOf(assessment).length} questão(ões)`
                        : ""
                  }`;
                  const heading = (
                    <>
                      <span
                        data-category={assessment.category}
                        className={`block font-mono ${
                          assessment.category === "extra"
                            ? "text-secondary"
                            : "text-primary"
                        }`}
                      >
                        {assessment.code}
                      </span>
                      <span className="block font-mono text-[0.65rem] font-normal normal-case text-muted-foreground">
                        {formatPoints(assessment.weight)}
                      </span>
                    </>
                  );
                  if (subCount === 0) {
                    return (
                      <th
                        key={assessment.id}
                        scope="col"
                        rowSpan={headRows}
                        data-tooltip={description}
                        className="w-20 border-l border-border/40 px-3 py-2 text-right font-semibold"
                      >
                        {coarse
                          ? tapInfo(
                              `a:${assessment.id}`,
                              `Detalhes de ${assessment.code}`,
                              "text-right",
                              heading,
                              <AssessmentInfo assessment={assessment} />,
                            )
                          : heading}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={assessment.id}
                      scope="colgroup"
                      colSpan={subCount + 1}
                      data-tooltip={description}
                      className="border-l border-border/40 px-3 py-2 text-center font-semibold"
                    >
                      {coarse
                        ? tapInfo(
                            `a:${assessment.id}`,
                            `Detalhes de ${assessment.code}`,
                            "text-center",
                            heading,
                            <AssessmentInfo assessment={assessment} />,
                          )
                        : heading}
                    </th>
                  );
                })}
                {showGrades && (
                  <th
                    scope="col"
                    rowSpan={headRows}
                    data-tooltip="Soma dos pontos obtidos, com os extras. A cor compara com os pontos já distribuídos ao discente."
                    className="w-20 border-l border-border/40 px-3 py-2 text-right font-semibold text-foreground"
                  >
                    Total
                  </th>
                )}
                {editing && (
                  <th scope="col" rowSpan={headRows} className="w-12 px-4 py-3">
                    <span className="sr-only">Remover</span>
                  </th>
                )}
              </tr>
              {headRows === 2 && (
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  {gradeColumns.flatMap((assessment) => {
                    const tasks = taskColumns(assessment);
                    const questions = questionColumns(assessment);
                    if (tasks.length + questions.length === 0) return [];
                    return [
                      ...questions.map((question, index) => (
                        <th
                          key={`${assessment.id}:${question.id}`}
                          scope="col"
                          data-tooltip={`${assessment.code} · ${question.name} (peso ${question.weight})`}
                          className={`w-16 px-0.5 py-2 text-center align-bottom font-normal normal-case ${
                            index === 0 ? "border-l border-border/40" : ""
                          }`}
                        >
                          {(() => {
                            const label = (
                              <span className="mx-auto block max-w-16 truncate font-mono text-[0.65rem] leading-tight">
                                {question.code || question.name}
                              </span>
                            );
                            return coarse
                              ? tapInfo(
                                  `q:${assessment.id}:${question.id}`,
                                  `Detalhes de ${question.name}`,
                                  "text-center",
                                  label,
                                  <QuestionInfo
                                    assessment={assessment}
                                    name={question.name}
                                    weight={`peso ${question.weight}`}
                                  />,
                                )
                              : label;
                          })()}
                        </th>
                      )),
                      ...tasks.map((task, index) => (
                        <th
                          key={`${assessment.id}:${task.id}`}
                          scope="col"
                          data-tooltip={`${assessment.code} · ${task.name}`}
                          className={`w-10 px-0.5 py-2 text-center align-bottom font-normal normal-case ${
                            index === 0 ? "border-l border-border/40" : ""
                          }`}
                        >
                          {(() => {
                            const label = (
                              <span className="mx-auto block max-w-10 truncate font-mono text-[0.65rem] leading-tight">
                                {task.code || task.name}
                              </span>
                            );
                            return coarse
                              ? tapInfo(
                                  `t:${assessment.id}:${task.id}`,
                                  `Detalhes de ${task.name}`,
                                  "text-center",
                                  label,
                                  <QuestionInfo
                                    assessment={assessment}
                                    name={task.name}
                                  />,
                                )
                              : label;
                          })()}
                        </th>
                      )),
                      <th
                        key={`${assessment.id}:grade`}
                        scope="col"
                        className="w-16 px-3 py-2 text-right align-bottom text-[0.65rem] font-normal normal-case"
                      >
                        nota
                      </th>,
                    ];
                  })}
                </tr>
              )}
            </thead>
            {view === "groups" ? (
              sections.map((section) => {
                const group = section.group;
                const isRenaming = group !== null && renaming?.id === group.id;
                return (
                  <DroppableBody
                    key={sectionDropId(group)}
                    id={sectionDropId(group)}
                    enabled={canDrag}
                  >
                    <tr className="bg-muted/40">
                      <th
                        scope="rowgroup"
                        colSpan={
                          showGrades
                            ? identityCols + 1
                            : editing
                              ? columns - 1
                              : columns
                        }
                        className="px-4 py-2 text-left"
                      >
                        {isRenaming ? (
                          <form
                            onSubmit={saveRename}
                            noValidate
                            onKeyDown={(e) => {
                              if (e.key === "Escape" && !busy)
                                setRenaming(null);
                            }}
                            className="flex flex-wrap items-center gap-2 font-normal"
                          >
                            <input
                              autoFocus
                              aria-label="Nome do grupo"
                              value={renaming.text}
                              onChange={(e) =>
                                setRenaming({
                                  id: group.id,
                                  text: e.target.value,
                                })
                              }
                              readOnly={busy}
                              className="w-64 max-w-full rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            <Button type="submit" size="sm" disabled={busy}>
                              {busy && <Loader2 className="animate-spin" />}
                              Salvar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setRenaming(null)}
                            >
                              Descartar
                            </Button>
                            {renameError && (
                              <p
                                role="alert"
                                className="w-full rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
                              >
                                {renameError}
                              </p>
                            )}
                          </form>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`font-serif text-sm font-semibold ${
                                group
                                  ? "text-foreground"
                                  : "italic text-muted-foreground"
                              }`}
                            >
                              {group?.name ?? "Sem grupo"}
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {section.rows.length}
                            </span>
                            {editing && group && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameError(null);
                                  setRenaming({
                                    id: group.id,
                                    text: group.name,
                                  });
                                }}
                                disabled={renaming !== null}
                                aria-label={`Renomear grupo ${group.name}`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        )}
                      </th>
                      {/* A group's own grade, under each assessment graded
                          per group: typing it here gives it to every member. */}
                      {gradeColumns.map((assessment) => {
                        const ofGroup =
                          group !== null && assessment.scoredBy === "group";
                        const members = group
                          ? current.filter(
                              (row) => String(row.groupId) === String(group.id),
                            )
                          : [];
                        // A task ticked on the group's row is ticked for
                        // every member.
                        const questionCells = questionColumns(assessment).map(
                          (question) => {
                            const mark = groupQuestionMark(
                              members,
                              assessment,
                              question.id,
                              currentScores,
                            );
                            const value =
                              mark.kind === "same" ? mark.percentage : null;
                            return (
                              <td
                                key={`${assessment.id}:${question.id}`}
                                title={
                                  mark.kind === "mixed"
                                    ? "Os integrantes têm notas diferentes nesta questão."
                                    : undefined
                                }
                                className="px-1 py-1 text-right font-mono text-xs font-semibold tabular-nums"
                              >
                                {ofGroup &&
                                  members.length > 0 &&
                                  gradeCell({
                                    id: `qg:${assessment.id}:${question.id}:${group.id}`,
                                    assessment,
                                    percentOnly: true,
                                    text:
                                      mark.kind === "mixed"
                                        ? "≠"
                                        : formatGrade(
                                            value,
                                            assessment.weight,
                                            "percent",
                                          ),
                                    initial: gradeInputValue(
                                      value,
                                      assessment.weight,
                                      "percent",
                                    ),
                                    label: `Nota do grupo ${group.name} em ${question.name}, de ${assessment.code}`,
                                  })}
                              </td>
                            );
                          },
                        );
                        const taskCells = taskColumns(assessment).map(
                          (task) => (
                            <td
                              key={`${assessment.id}:${task.id}`}
                              className="px-0.5 py-1 text-center"
                            >
                              {ofGroup && members.length > 0 && (
                                <TaskCheckbox
                                  cellId={`tg:${assessment.id}:${task.id}:${group.id}`}
                                  onNavigate={goToCell}
                                  label={`Grupo ${group.name} fez ${task.name}, de ${assessment.code}`}
                                  state={groupTaskState(
                                    members,
                                    assessment,
                                    task.id,
                                    currentScores,
                                  )}
                                  onChange={(checked) =>
                                    setTaskDone(
                                      assessment,
                                      task,
                                      members,
                                      checked,
                                    )
                                  }
                                />
                              )}
                            </td>
                          ),
                        );
                        if (!group || !ofGroup) {
                          return (
                            <Fragment key={assessment.id}>
                              {questionCells}
                              {taskCells}
                              <td />
                            </Fragment>
                          );
                        }
                        const grade = groupPercentage(
                          members,
                          assessment,
                          currentScores,
                        );
                        const percentage =
                          grade.kind === "same" ? grade.percentage : null;
                        const tone = gradeTone(percentage);
                        return (
                          <Fragment key={assessment.id}>
                            {questionCells}
                            {taskCells}
                            <td
                              data-tone={tone ?? undefined}
                              data-group-grade={grade.kind}
                              title={
                                grade.kind === "mixed"
                                  ? "Os integrantes têm notas diferentes nesta avaliação."
                                  : undefined
                              }
                              className={`text-right font-mono text-xs font-semibold tabular-nums ${
                                enteringGrades && assessment.mode === "graded"
                                  ? "px-1 py-1"
                                  : "px-3 py-2"
                              } ${
                                grade.kind === "mixed"
                                  ? "text-muted-foreground"
                                  : toneClass(tone)
                              }`}
                            >
                              {gradeCell({
                                id: `g:${assessment.id}:${group.id}`,
                                assessment,
                                text:
                                  grade.kind === "mixed"
                                    ? "≠"
                                    : formatGrade(
                                        percentage,
                                        assessment.weight,
                                        gradeDisplay,
                                      ),
                                initial: gradeInputValue(
                                  percentage,
                                  assessment.weight,
                                  gradeDisplay,
                                ),
                                label: `Nota do grupo ${group.name} em ${assessment.code}`,
                              })}
                            </td>
                          </Fragment>
                        );
                      })}
                      {showGrades && (
                        <td className="border-l border-border/40" />
                      )}
                      {editing && (
                        <td className="px-4 py-1 text-right">
                          {section.group && (
                            <Popover
                              open={removingGroupId === section.group.id}
                              onOpenChange={(open) => {
                                if (open) {
                                  setRemoveError(null);
                                  setRemovingGroupId(section.group!.id);
                                } else if (!busy) {
                                  setRemovingGroupId(null);
                                }
                              }}
                            >
                              <PopoverTrigger
                                aria-label={`Remover grupo ${section.group.name}`}
                                className="inline-flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 data-[state=open]:bg-red-500/10 data-[state=open]:text-red-600 dark:text-red-400/60 dark:hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </PopoverTrigger>
                              <PopoverContent
                                side="left"
                                align="center"
                                sideOffset={8}
                                aria-label="Remover grupo?"
                                className="w-72 space-y-3 p-3 text-left duration-75"
                              >
                                <p className="text-sm font-semibold text-foreground">
                                  Remover grupo?
                                </p>
                                <p className="text-xs font-normal leading-relaxed text-muted-foreground">
                                  <strong className="text-foreground">
                                    {section.group.name}
                                  </strong>{" "}
                                  deixará de existir.{" "}
                                  {section.rows.length > 0
                                    ? "Seus integrantes continuam na oferta, sem grupo."
                                    : "Ele não tem integrantes."}
                                </p>
                                {removeError && (
                                  <p
                                    role="alert"
                                    className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
                                  >
                                    {removeError}
                                  </p>
                                )}
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => setRemovingGroupId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => removeGroup(section.group!)}
                                  >
                                    {busy && (
                                      <Loader2 className="animate-spin" />
                                    )}
                                    Remover
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </td>
                      )}
                    </tr>
                    {section.rows.map((row) =>
                      canDrag ? (
                        <DraggableRow key={row.id} id={`row:${row.id}`}>
                          {(drag) => renderRow(row, drag)}
                        </DraggableRow>
                      ) : (
                        renderRow(row)
                      ),
                    )}
                    {section.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns}
                          className="px-4 py-2.5 text-xs italic text-muted-foreground"
                        >
                          {canDrag
                            ? "Arraste um discente para cá."
                            : "Nenhum integrante."}
                        </td>
                      </tr>
                    )}
                  </DroppableBody>
                );
              })
            ) : (
              <tbody className="divide-y divide-border/40">
                {visible.map((row) => renderRow(row))}
              </tbody>
            )}
            {visible.length === 0 &&
              (view === "students" || sections.length === 0) && (
                <tbody>
                  <tr>
                    <td
                      colSpan={columns}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {current.length === 0
                        ? "Nenhum discente cadastrado nesta oferta."
                        : "Nenhum discente encontrado."}
                    </td>
                  </tr>
                </tbody>
              )}
          </table>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged && (
            <div className="inline-flex cursor-grabbing items-center gap-2 rounded-lg border border-primary/40 bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-lg">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              {dragged.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

/** What a draggable row needs from dnd-kit, handed to `renderRow`. */
type DragWiring = Pick<
  ReturnType<typeof useDraggable>,
  | "setNodeRef"
  | "setActivatorNodeRef"
  | "attributes"
  | "listeners"
  | "isDragging"
>;

/**
 * One section of the "by group" view, as its own `<tbody>` — which is also
 * the area a dragged student can be dropped on. Lights up while one hovers.
 */
function DroppableBody({
  id,
  enabled,
  children,
}: {
  id: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });
  return (
    <tbody
      ref={setNodeRef}
      data-drop-zone={id}
      className={`divide-y divide-border/40 border-t border-border/40 transition-colors first:border-t-0 ${
        isOver
          ? "bg-primary/10 outline outline-1 -outline-offset-1 outline-primary/40"
          : ""
      }`}
    >
      {children}
    </tbody>
  );
}

/** Makes a row draggable; the row itself is drawn by its caller. */
function DraggableRow({
  id,
  children,
}: {
  id: string;
  children: (drag: DragWiring) => ReactNode;
}) {
  const drag = useDraggable({ id });
  return <>{children(drag)}</>;
}

/** What a task's or question's heading abbreviates, in full. */
function QuestionInfo({
  assessment,
  name,
  weight,
}: {
  assessment: AssessmentRow;
  name: string;
  weight?: string;
}) {
  return (
    <div className="space-y-1 text-left text-xs font-normal normal-case tracking-normal">
      <p className="text-sm font-semibold leading-snug text-foreground">
        {name}
      </p>
      <p className="text-muted-foreground">
        em <span className="font-mono text-primary">{assessment.code}</span>
        {weight ? ` · ${weight}` : ""} · {assessment.name}
      </p>
    </div>
  );
}

/** Whether a grade cell id is a task's checkbox rather than a number. */
const isCheckboxCell = (id: string) =>
  id.startsWith("t:") || id.startsWith("tg:");

/** What each arrow key does in a grade cell: which way, and along what. */
const ARROWS: Record<string, [1 | -1, "across" | "down"]> = {
  ArrowRight: [1, "across"],
  ArrowLeft: [-1, "across"],
  ArrowDown: [1, "down"],
  ArrowUp: [-1, "down"],
};

/**
 * The input a grade cell turns into. Tab saves and moves to the cell on the
 * right (the next assessment or question, same student); Enter saves and
 * moves to the cell below (the next student, same column). Shift+Tab and
 * Shift+Enter go the other way. Esc gives up; leaving the cell any other
 * way saves too. The arrow keys do the same as Tab (left, right) and Enter
 * (up, down) — Left and Right only once the caret is at the edge of the
 * text, so that the number can still be edited — and never close the cell
 * when there is nowhere to go.
 *
 * On a touch screen there is no Tab or Esc, and a stray tap or a scroll
 * would "leave the cell" and save by accident: so nothing is saved on
 * leaving, and ✓ / ✕ buttons confirm or give up explicitly. Enter still
 * confirms and goes on to the next student.
 */
function GradeInput({
  label,
  tag,
  initial,
  suffix,
  max,
  error,
  onCommit,
  onClose,
  onMove,
  hasNext,
}: {
  label: string;
  /** What is being graded, short: "P1" or "P1 · Q2". Shown on touch screens. */
  tag?: string;
  initial: string;
  suffix?: string;
  max: string;
  error: string | null;
  /** Saves the text; false when it is not a valid grade. */
  onCommit: (text: string) => boolean;
  onClose: () => void;
  /** Tab goes across the row; Enter goes down the column. */
  onMove: (direction: 1 | -1, axis: "across" | "down") => void;
  /** Whether there is a cell that way: an arrow key never closes the cell. */
  hasNext: (direction: 1 | -1, axis: "across" | "down") => boolean;
}) {
  const [value, setValue] = useState(initial);
  const coarse = useCoarsePointer();
  // Set once the cell has been dealt with, so that the blur which follows a
  // Tab or an Esc does not save a second time.
  const done = useRef(false);

  return (
    <span className={`relative block ${coarse ? "h-10" : ""}`}>
      {/* On a touch screen the columns of grades are too narrow to see what
          is being typed: the box opens wider over its neighbours. */}
      <span
        className={
          coarse
            ? "absolute right-0 top-0 z-30 block w-36 rounded shadow-lg"
            : "block"
        }
      >
        {coarse && tag && (
          <span
            data-grade-tag
            className="pointer-events-none absolute -top-2.5 left-1.5 z-10 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-primary px-2 py-px font-mono text-[0.65rem] font-semibold leading-4 text-primary-foreground shadow"
          >
            {tag}
          </span>
        )}
        <input
          autoFocus
          aria-label={label}
          aria-invalid={error ? true : undefined}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder={`0–${max}`}
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) =>
            setValue(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))
          }
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              done.current = true;
              onClose();
            } else if (ARROWS[e.key]) {
              const [direction, axis] = ARROWS[e.key];
              const field = e.currentTarget;
              // Left and Right are the caret's while it is inside the text;
              // at an edge (or with the whole text selected, as on opening)
              // they go to the neighbouring cell. Up and Down always do.
              const atEdge =
                e.key === "ArrowLeft"
                  ? field.selectionStart === 0
                  : e.key === "ArrowRight"
                    ? field.selectionEnd === field.value.length
                    : true;
              if (!atEdge || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) {
                return;
              }
              e.preventDefault();
              if (!hasNext(direction, axis)) return;
              if (!onCommit(value)) return;
              done.current = true;
              onMove(direction, axis);
            } else if (e.key === "Tab" || e.key === "Enter") {
              e.preventDefault();
              if (!onCommit(value)) return;
              done.current = true;
              onMove(e.shiftKey ? -1 : 1, e.key === "Tab" ? "across" : "down");
            }
          }}
          onBlur={() => {
            // A finger leaves by accident: wait for ✓ or ✕ instead.
            if (done.current || coarse) return;
            // An invalid grade is dropped rather than trapping the focus.
            onCommit(value);
            done.current = true;
            onClose();
          }}
          className={`w-full rounded border bg-input py-1.5 text-right font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 [@media(pointer:coarse)]:text-base ${
            suffix ? "pl-1 pr-4" : "px-2"
          } ${
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-primary focus-visible:ring-ring"
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-muted-foreground">
            {suffix}
          </span>
        )}
      </span>
      {coarse && (
        <span className="absolute right-0 top-full z-30 mt-1 flex gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
          <button
            type="button"
            aria-label="Confirmar nota"
            onClick={() => {
              if (!onCommit(value)) return;
              done.current = true;
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded bg-primary text-primary-foreground"
          >
            <Check className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Cancelar edição da nota"
            onClick={() => {
              done.current = true;
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </span>
      )}
      {error && !coarse && (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-red-500/30 bg-popover px-2 py-1 text-left font-sans text-[0.7rem] font-normal normal-case leading-snug text-red-700 shadow-md dark:text-red-300"
        >
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * A task's checkbox. `state` is "some" on a group's row when only part of
 * the group has done the task: it then shows as indeterminate, and a click
 * marks it done for everyone.
 */
function TaskCheckbox({
  label,
  state,
  onChange,
  cellId,
  onNavigate,
}: {
  label: string;
  state: "all" | "none" | "some";
  onChange: (checked: boolean) => void;
  /** Its place in the grid of grade cells, for the arrow keys. */
  cellId: string;
  onNavigate: (id: string, direction: 1 | -1, axis: "across" | "down") => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={box}
      type="checkbox"
      data-grade-cell={cellId}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.shiftKey && e.key !== "Enter") return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const move =
          e.key === "Enter" ? [e.shiftKey ? -1 : 1, "down"] : ARROWS[e.key];
        if (!move) return;
        e.preventDefault();
        onNavigate(cellId, move[0] as 1 | -1, move[1] as "across" | "down");
      }}
      checked={state === "all"}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-border [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6 align-middle accent-[hsl(var(--primary))]"
    />
  );
}
