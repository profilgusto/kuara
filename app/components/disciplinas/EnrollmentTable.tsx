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
  PointerSensor,
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
  GripVertical,
  Hash,
  Loader2,
  Pencil,
  Percent,
  Search,
  TextCursorInput,
  Trash2,
  User,
  UserMinus,
} from "lucide-react";
import { UsersThreeIcon } from "@/components/ui/users-three-icon";
import { GradeIcon } from "@/components/ui/grade-icon";
import {
  formatPoints,
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
  groupTaskState,
  nextGradeCell,
  parseGradeInput,
  percentageFor,
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
import { EnrollStudentsModal } from "./EnrollStudentsModal";
import { GroupsModal } from "./GroupsModal";
import { SigaaExportModal } from "./SigaaExportModal";

type Direction = "asc" | "desc";

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
  const [gradeDisplay, setGradeDisplay] = useState<GradeDisplay>("points");
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
    return list;
  }, [scores, scoreOverrides, taskOverrides]);
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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
  // While grades are being entered, a checklist assessment opens up into
  // one checkbox column per task, to the left of its grade.
  const taskColumns = (assessment: AssessmentRow): AssessmentTask[] =>
    enteringGrades && assessment.mode === "checklist" ? assessment.tasks : [];
  // Checkbox columns need a second heading row: the assessment's name spans
  // them all, and the task labels sit beneath it.
  const headRows = gradeColumns.some((a) => taskColumns(a).length > 0) ? 2 : 1;
  const columns =
    (split ? 3 : 2) +
    // One column per assessment (plus its tasks' checkboxes), and the total.
    (showGrades
      ? gradeColumns.reduce((n, a) => n + 1 + taskColumns(a).length, 0) + 1
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

    void (async () => {
      const undo = (message: string) => {
        setTaskOverrides((ticked) => ({ ...ticked, ...before }));
        setMoveError(message);
      };
      try {
        const res = await fetch(comBasePath("/api/scores/tasks"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            offer: offerId,
            activity: assessment.id,
            task: task.id,
            enrollments: changed.map((row) => row.id),
            done,
          }),
        });
        if (!res.ok) {
          undo(
            res.status === 401 || res.status === 403
              ? "Sua sessão não permite lançar notas. Entre novamente como administrador."
              : `Não foi possível salvar “${task.name}” em ${assessment.code}. Tente novamente.`,
          );
          return;
        }
        router.refresh();
      } catch {
        undo("Erro de conexão ao salvar a tarefa. Tente novamente.");
      }
    })();
  }

  // Editable cells, per assessment, top to bottom as on screen: the order
  // Tab walks in. A group's own cell comes right above its members'.
  const gradeCellOrder = useMemo(
    () =>
      gradeColumns
        .filter((assessment) => assessment.mode !== "checklist")
        .map((assessment) =>
          view === "groups"
            ? sections.flatMap((section) => [
                ...(section.group && assessment.scoredBy === "group"
                  ? [`g:${assessment.id}:${section.group.id}`]
                  : []),
                ...section.rows.map((row) => `s:${assessment.id}:${row.id}`),
              ])
            : visible.map((row) => `s:${assessment.id}:${row.id}`),
        ),
    [gradeColumns, view, sections, visible],
  );

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

    void (async () => {
      const undo = (message: string) => {
        setScoreOverrides((typed) => ({ ...typed, ...before }));
        setMoveError(message);
      };
      try {
        const res = await fetch(comBasePath("/api/scores/set"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            offer: offerId,
            activity: assessment.id,
            enrollments: changed.map((row) => row.id),
            percentage: parsed.percentage,
          }),
        });
        if (!res.ok) {
          undo(
            res.status === 401 || res.status === 403
              ? "Sua sessão não permite lançar notas. Entre novamente como administrador."
              : `Não foi possível salvar a nota de ${assessment.code}. Tente novamente.`,
          );
          return;
        }
        router.refresh();
      } catch {
        undo("Erro de conexão ao salvar a nota. Tente novamente.");
      }
    })();
    return true;
  }

  /** What goes inside a grade cell: plain text, a button, or the input. */
  const gradeCell = ({
    id,
    assessment,
    text,
    initial,
    label,
  }: {
    id: string;
    assessment: AssessmentRow;
    text: string;
    initial: string;
    label: string;
  }) => {
    // A checklist's grade is worked out from its tasks, never typed.
    if (!enteringGrades || assessment.mode === "checklist") return text;
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
          className="w-full rounded px-2 py-1.5 text-right transition-colors hover:bg-primary/10 hover:outline hover:outline-1 hover:outline-primary/40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
        >
          {text}
        </button>
      );
    }
    return (
      <GradeInput
        key={id}
        label={label}
        initial={initial}
        suffix={gradeDisplay === "percent" ? "%" : undefined}
        max={
          gradeDisplay === "percent" ? "100" : formatPoints(assessment.weight)
        }
        error={cellError}
        onCommit={(value) => commitGrade(id, value)}
        onClose={() => {
          setCellError(null);
          setOpenCell(null);
        }}
        onMove={(direction) => {
          setCellError(null);
          setOpenCell(nextGradeCell(gradeCellOrder, id, direction));
        }}
      />
    );
  };

  const sortButton = (target: EnrollmentSortField, label: string) => {
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
        {label}
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
          drag ? "cursor-grab touch-none select-none" : ""
        } ${drag?.isDragging ? "opacity-30" : ""}`}
      >
        {split && (
          <td className="px-4 py-2.5 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {handle}
              {row.classGroup ?? "—"}
            </span>
          </td>
        )}
        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
          {split ? (
            row.registration
          ) : (
            <span className="flex items-center gap-1.5">
              {handle}
              {row.registration}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 font-medium">{row.name}</td>
        {gradeColumns.map((assessment) => {
          const percentage = percentageFor(row, assessment, currentScores);
          const tone = gradeTone(percentage);
          const done = completedTasksFor(row, assessment, currentScores);
          return (
            <Fragment key={assessment.id}>
              {taskColumns(assessment).map((task) => (
                <td key={task.id} className="px-0.5 py-1 text-center">
                  <TaskCheckbox
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
                  enteringGrades && assessment.mode !== "checklist"
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
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 dark:text-red-400/60 dark:hover:text-red-400"
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
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 data-[state=open]:bg-red-500/10 data-[state=open]:text-red-600 dark:text-red-400/60 dark:hover:text-red-400"
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
      className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
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
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
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
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
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
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
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
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
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
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  gradeDisplay === "percent"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Percent className="h-4 w-4" />
              </button>
            </div>
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
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
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
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                {split && (
                  <th
                    scope="col"
                    rowSpan={headRows}
                    className="w-28 px-4 py-3 font-semibold"
                    aria-sort={
                      field === "classGroup"
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {sortButton("classGroup", "Turma")}
                  </th>
                )}
                <th
                  scope="col"
                  rowSpan={headRows}
                  className="w-40 px-4 py-3 font-semibold"
                  aria-sort={
                    field === "registration"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {sortButton("registration", "Matrícula")}
                </th>
                <th
                  scope="col"
                  rowSpan={headRows}
                  className="px-4 py-3 font-semibold"
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
                  const tasks = taskColumns(assessment);
                  const description = `${assessment.name} — vale ${formatPoints(assessment.weight)}${
                    assessment.scoredBy === "group" ? ", por grupo" : ""
                  }${
                    assessment.mode === "checklist"
                      ? `, ${assessment.tasks.length} tarefa(s)`
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
                  if (tasks.length === 0) {
                    return (
                      <th
                        key={assessment.id}
                        scope="col"
                        rowSpan={headRows}
                        data-tooltip={description}
                        className="w-20 border-l border-border/40 px-3 py-2 text-right font-semibold"
                      >
                        {heading}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={assessment.id}
                      scope="colgroup"
                      colSpan={tasks.length + 1}
                      data-tooltip={description}
                      className="border-l border-border/40 px-3 py-2 text-center font-semibold"
                    >
                      {heading}
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
                    if (tasks.length === 0) return [];
                    return [
                      ...tasks.map((task, index) => (
                        <th
                          key={`${assessment.id}:${task.id}`}
                          scope="col"
                          data-tooltip={`${assessment.code} · ${task.name}`}
                          className={`w-10 px-0.5 py-2 text-center align-bottom font-normal normal-case ${
                            index === 0 ? "border-l border-border/40" : ""
                          }`}
                        >
                          <span className="mx-auto block max-w-10 truncate font-mono text-[0.65rem] leading-tight">
                            {task.code || task.name}
                          </span>
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
                            ? split
                              ? 3
                              : 2
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
                        const taskCells = taskColumns(assessment).map(
                          (task) => (
                            <td
                              key={`${assessment.id}:${task.id}`}
                              className="px-0.5 py-1 text-center"
                            >
                              {ofGroup && members.length > 0 && (
                                <TaskCheckbox
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
                                enteringGrades &&
                                assessment.mode !== "checklist"
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
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 data-[state=open]:bg-red-500/10 data-[state=open]:text-red-600 dark:text-red-400/60 dark:hover:text-red-400"
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

/**
 * The input a grade cell turns into. Tab and Enter save and move on to the
 * next student in the same assessment; Shift+Tab goes back; Esc gives up;
 * leaving the cell any other way saves too.
 */
function GradeInput({
  label,
  initial,
  suffix,
  max,
  error,
  onCommit,
  onClose,
  onMove,
}: {
  label: string;
  initial: string;
  suffix?: string;
  max: string;
  error: string | null;
  /** Saves the text; false when it is not a valid grade. */
  onCommit: (text: string) => boolean;
  onClose: () => void;
  onMove: (direction: 1 | -1) => void;
}) {
  const [value, setValue] = useState(initial);
  // Set once the cell has been dealt with, so that the blur which follows a
  // Tab or an Esc does not save a second time.
  const done = useRef(false);

  return (
    <span className="relative block">
      <input
        autoFocus
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode="decimal"
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
          } else if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            if (!onCommit(value)) return;
            done.current = true;
            onMove(e.shiftKey ? -1 : 1);
          }
        }}
        onBlur={() => {
          if (done.current) return;
          // An invalid grade is dropped rather than trapping the focus.
          onCommit(value);
          done.current = true;
          onClose();
        }}
        className={`w-full rounded border bg-input py-1.5 text-right font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 ${
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
      {error && (
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
}: {
  label: string;
  state: "all" | "none" | "some";
  onChange: (checked: boolean) => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={box}
      type="checkbox"
      aria-label={label}
      checked={state === "all"}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-border align-middle accent-[hsl(var(--primary))]"
    />
  );
}
